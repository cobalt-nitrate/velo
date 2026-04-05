import { loadConfig } from '@velo/core/config';
import type { AgentContext, WorkflowDefinition, WorkflowStep } from '@velo/core/types';
import {
  advanceWorkflowRun,
  clearWorkflowPendingApproval,
  getWorkflowRun,
  setWorkflowAwaitingApproval,
  setWorkflowRunStatus,
  startWorkflowRun,
  syncWorkflowRunsFromDisk,
} from '@velo/core/workflow';
import { runAgent } from '../runner.js';
import { invokeRegisteredTool } from './tool-invoke.js';

// ─── Path helpers ─────────────────────────────────────────────────────────────

function getPath(ctx: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function resolveInputFrom(
  context: Record<string, unknown>,
  inputFrom: unknown
): Record<string, unknown> {
  if (inputFrom == null) return {};
  if (typeof inputFrom === 'string') {
    if (inputFrom === 'trigger.payload') {
      const trigger = context.trigger as Record<string, unknown> | undefined;
      const payload = trigger?.payload;
      return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    }
    const v = getPath(context, inputFrom);
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : { value: v };
  }
  if (Array.isArray(inputFrom)) {
    const out: Record<string, unknown> = {};
    for (const key of inputFrom) {
      if (typeof key !== 'string') continue;
      out[key.replace(/\./g, '_')] = getPath(context, key);
    }
    return out;
  }
  return {};
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

type Operator = '===' | '==' | '!==' | '!=' | '>=' | '<=' | '>' | '<';
const OPERATORS: Operator[] = ['===', '==', '!==', '!=', '>=', '<=', '>', '<'];

function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  const trimmed = condition.trim();

  if (trimmed.startsWith('!')) {
    const path = trimmed.slice(1).trim();
    const value = getPath(context, path);
    return !value;
  }

  for (const op of OPERATORS) {
    const idx = trimmed.indexOf(op);
    if (idx < 0) continue;

    const lhsRaw = trimmed.slice(0, idx).trim();
    const rhsRaw = trimmed.slice(idx + op.length).trim();

    const lhsValue = getPath(context, lhsRaw);
    const rhsValue = parseLiteral(rhsRaw);

    switch (op) {
      case '===':
      case '==':
        return lhsValue === rhsValue;
      case '!==':
      case '!=':
        return lhsValue !== rhsValue;
      case '>=':
        return Number(lhsValue) >= Number(rhsValue);
      case '<=':
        return Number(lhsValue) <= Number(rhsValue);
      case '>':
        return Number(lhsValue) > Number(rhsValue);
      case '<':
        return Number(lhsValue) < Number(rhsValue);
    }
  }

  const value = getPath(context, trimmed);
  return !!value;
}

function parseLiteral(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw === 'undefined') return undefined;
  const num = Number(raw);
  if (!isNaN(num)) return num;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

type StepResult =
  | { kind: 'advanced' }
  | { kind: 'pending_approval'; detail: unknown }
  | { kind: 'failed'; detail: unknown };

async function runSingleWorkflowStep(
  step: WorkflowStep,
  runId: string,
  agentContext: AgentContext
): Promise<StepResult> {
  const stepNo = step.step;

  const current = getWorkflowRun(runId);
  if (!current) {
    return { kind: 'failed', detail: 'Run lost' };
  }
  const ctx = current.context;

  if (step.condition) {
    try {
      const conditionMet = evaluateCondition(String(step.condition), ctx);
      if (!conditionMet) {
        advanceWorkflowRun(runId, stepNo + 1, {
          [`skipped_condition_${step.id}`]: true,
        });
        return { kind: 'advanced' };
      }
    } catch (condErr) {
      advanceWorkflowRun(runId, stepNo + 1, {
        [`condition_error_${step.id}`]: String(condErr),
      });
      return { kind: 'advanced' };
    }
  }

  const onError = step.on_error as string | undefined;

  if (step.action === 'tool_call' && typeof step.tool === 'string') {
    const input = resolveInputFrom(ctx, step.input_from);
    try {
      const toolResult = await invokeRegisteredTool(step.tool, {
        ...input,
        company_id: agentContext.company_id,
      });
      const outputTo =
        typeof step.output_to === 'string' ? step.output_to : `_out_${step.id}`;
      advanceWorkflowRun(runId, stepNo + 1, {
        [outputTo]: toolResult,
      });
    } catch (toolErr) {
      if (onError === 'continue') {
        advanceWorkflowRun(runId, stepNo + 1, {
          [`error_${step.id}`]: String(toolErr),
        });
        return { kind: 'advanced' };
      }
      setWorkflowRunStatus(runId, 'FAILED', String(toolErr));
      return { kind: 'failed', detail: String(toolErr) };
    }
    return { kind: 'advanced' };
  }

  if (typeof step.agent === 'string') {
    const input = resolveInputFrom(ctx, step.input_from);
    try {
      const ar = await runAgent(step.agent, input, agentContext);

      if (ar.status === 'PENDING_APPROVAL') {
        const toolId = ar.approval_request?.tool_id ?? '';
        if (!toolId) {
          setWorkflowRunStatus(
            runId,
            'FAILED',
            'Approval requested without tool_id — upgrade runner / agent package'
          );
          return { kind: 'failed', detail: 'Missing tool_id on approval' };
        }
        setWorkflowAwaitingApproval(runId, {
          approval_id: ar.approval_id ?? '',
          tool_id: toolId,
          tool_parameters: ar.approval_request?.action_payload ?? {},
        });
        return { kind: 'pending_approval', detail: ar };
      }

      if (ar.status === 'REFUSED' || ar.status === 'FAILED') {
        if (onError === 'continue') {
          advanceWorkflowRun(runId, stepNo + 1, {
            [`error_${step.id}`]: ar.error,
          });
          return { kind: 'advanced' };
        }
        setWorkflowRunStatus(runId, 'FAILED', ar.error);
        return { kind: 'failed', detail: ar };
      }

      const outputTo =
        typeof step.output_to === 'string' ? step.output_to : `_agent_${step.id}`;
      advanceWorkflowRun(runId, stepNo + 1, {
        [outputTo]: ar.output,
      });
    } catch (agentErr) {
      if (onError === 'continue') {
        advanceWorkflowRun(runId, stepNo + 1, {
          [`error_${step.id}`]: String(agentErr),
        });
        return { kind: 'advanced' };
      }
      setWorkflowRunStatus(runId, 'FAILED', String(agentErr));
      return { kind: 'failed', detail: String(agentErr) };
    }
    return { kind: 'advanced' };
  }

  advanceWorkflowRun(runId, stepNo + 1, {
    [`skipped_${step.id}`]: true,
  });
  return { kind: 'advanced' };
}

async function drainWorkflowRun(
  runId: string,
  agentContext: AgentContext,
  sorted: WorkflowStep[]
): Promise<{
  run_id: string;
  status: string;
  context?: Record<string, unknown>;
  detail?: unknown;
}> {
  for (;;) {
    const current = getWorkflowRun(runId);
    if (!current) {
      return { run_id: runId, status: 'FAILED', detail: 'Run lost' };
    }

    const step = sorted.find((s) => s.step === current.current_step) as
      | WorkflowStep
      | undefined;
    if (!step) {
      setWorkflowRunStatus(runId, 'COMPLETED');
      const final = getWorkflowRun(runId);
      return {
        run_id: runId,
        status: 'COMPLETED',
        context: final?.context,
      };
    }

    const result = await runSingleWorkflowStep(step, runId, agentContext);
    if (result.kind === 'pending_approval') {
      return {
        run_id: runId,
        status: 'WAITING_FOR_APPROVAL',
        detail: result.detail,
      };
    }
    if (result.kind === 'failed') {
      return { run_id: runId, status: 'FAILED', detail: result.detail };
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runWorkflowLinear(
  workflowKey: string,
  initialContext: Record<string, unknown>,
  agentContext: AgentContext
): Promise<{
  run_id: string;
  status: string;
  context?: Record<string, unknown>;
  detail?: unknown;
}> {
  const workflow = loadConfig(
    `workflows/${workflowKey}` as `workflows/${string}`
  ) as WorkflowDefinition;

  const state = startWorkflowRun(
    workflow,
    {
      ...initialContext,
      trigger: initialContext.trigger ?? { payload: {} },
    },
    workflowKey
  );

  const sorted = [...workflow.steps].sort((a, b) => a.step - b.step);
  return drainWorkflowRun(state.run_id, agentContext, sorted);
}

/**
 * After PATCH /api/approvals/:id (APPROVED), call this with the same run_id returned from
 * runWorkflowLinear when status was WAITING_FOR_APPROVAL.
 */
export async function resumeWorkflowAfterApproval(
  runId: string,
  agentContext: AgentContext,
  options?: { skipApprovalCheck?: boolean }
): Promise<{
  run_id: string;
  status: string;
  context?: Record<string, unknown>;
  detail?: unknown;
}> {
  syncWorkflowRunsFromDisk();

  const run = getWorkflowRun(runId);
  if (!run || run.status !== 'WAITING_FOR_APPROVAL') {
    return {
      run_id: runId,
      status: 'FAILED',
      detail: 'Run is not waiting for approval',
    };
  }
  if (!run.pending_tool_id || !run.pending_approval_id) {
    return {
      run_id: runId,
      status: 'FAILED',
      detail: 'Run missing deferred tool metadata',
    };
  }

  const wfKey = run.workflow_config_key;
  if (!wfKey) {
    return {
      run_id: runId,
      status: 'FAILED',
      detail: 'Run missing workflow_config_key',
    };
  }

  if (!options?.skipApprovalCheck) {
    const { findApprovalById, isApprovalApprovedStatus } = await import(
      '@velo/tools/sheets'
    );
    const found = await findApprovalById(run.pending_approval_id);
    if (!found?.row) {
      return { run_id: runId, status: 'FAILED', detail: 'Approval row not found' };
    }
    if (!isApprovalApprovedStatus(found.row.status)) {
      return {
        run_id: runId,
        status: 'FAILED',
        detail: `Approval not approved (status=${found.row.status})`,
      };
    }
  }

  const workflow = loadConfig(
    `workflows/${wfKey}` as `workflows/${string}`
  ) as WorkflowDefinition;
  const sorted = [...workflow.steps].sort((a, b) => a.step - b.step);
  const step = sorted.find((s) => s.step === run.current_step) as WorkflowStep | undefined;

  if (!step || typeof step.agent !== 'string') {
    return {
      run_id: runId,
      status: 'FAILED',
      detail: 'Paused run must be on an agent step',
    };
  }

  setWorkflowRunStatus(runId, 'RUNNING');

  try {
    const toolResult = await invokeRegisteredTool(run.pending_tool_id, {
      ...(run.pending_tool_params ?? {}),
      tool_id: run.pending_tool_id,
      company_id: agentContext.company_id,
    });
    const outputTo =
      typeof step.output_to === 'string' ? step.output_to : `_agent_${step.id}`;
    advanceWorkflowRun(runId, step.step + 1, { [outputTo]: toolResult });
    clearWorkflowPendingApproval(runId);
  } catch (err) {
    setWorkflowRunStatus(runId, 'FAILED', String(err));
    return { run_id: runId, status: 'FAILED', detail: String(err) };
  }

  return drainWorkflowRun(runId, agentContext, sorted);
}
