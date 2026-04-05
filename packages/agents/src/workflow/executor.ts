import { loadConfig } from '@velo/core/config';
import type { AgentContext, WorkflowDefinition, WorkflowStep } from '@velo/core/types';
import {
  advanceWorkflowRun,
  getWorkflowRun,
  setWorkflowRunStatus,
  startWorkflowRun,
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
//
// Supported condition formats (strings evaluated against workflow context):
//   "step_output.is_duplicate === true"
//   "step_output.confidence >= 0.85"
//   "context.vendor_matched === true"
//   "!context.itc_claimable"
//   "${path} === ${value}"   (path resolved from context, value is a literal)
//
// Security: we evaluate a very restricted expression set. No eval() is used.
// The grammar is: [path] [op] [literal] | [!][path]

type Operator = '===' | '==' | '!==' | '!=' | '>=' | '<=' | '>' | '<';
const OPERATORS: Operator[] = ['===', '==', '!==', '!=', '>=', '<=', '>', '<'];

function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  const trimmed = condition.trim();

  // Unary negation: "!path.to.value"
  if (trimmed.startsWith('!')) {
    const path = trimmed.slice(1).trim();
    const value = getPath(context, path);
    return !value;
  }

  // Binary comparison: "path op literal"
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

  // Truthy check: just resolve the path
  const value = getPath(context, trimmed);
  return !!value;
}

function parseLiteral(raw: string): unknown {
  // true / false
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw === 'undefined') return undefined;
  // Number
  const num = Number(raw);
  if (!isNaN(num)) return num;
  // String (strip quotes)
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

// ─── Workflow runner ──────────────────────────────────────────────────────────

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

  let state = startWorkflowRun(workflow, {
    ...initialContext,
    trigger: initialContext.trigger ?? { payload: {} },
  });

  const sorted = [...workflow.steps].sort((a, b) => a.step - b.step);

  for (const raw of sorted) {
    const step = raw as WorkflowStep;
    const stepNo = step.step;

    const current = getWorkflowRun(state.run_id);
    if (!current) {
      return { run_id: state.run_id, status: 'FAILED', detail: 'Run lost' };
    }
    const ctx = current.context;

    // ── Condition gate ──────────────────────────────────────────────────────
    if (step.condition) {
      try {
        const conditionMet = evaluateCondition(String(step.condition), ctx);
        if (!conditionMet) {
          // Skip this step — advance without writing output
          state = advanceWorkflowRun(state.run_id, stepNo + 1, {
            [`skipped_condition_${step.id}`]: true,
          });
          continue;
        }
      } catch (condErr) {
        // If condition evaluation fails, skip the step and log
        state = advanceWorkflowRun(state.run_id, stepNo + 1, {
          [`condition_error_${step.id}`]: String(condErr),
        });
        continue;
      }
    }

    // ── on_error override for this step ─────────────────────────────────────
    const onError = step.on_error as string | undefined;

    // ── Tool call step ───────────────────────────────────────────────────────
    if (step.action === 'tool_call' && typeof step.tool === 'string') {
      const input = resolveInputFrom(ctx, step.input_from);
      try {
        const toolResult = await invokeRegisteredTool(step.tool, {
          ...input,
          company_id: agentContext.company_id,
        });
        const outputTo =
          typeof step.output_to === 'string' ? step.output_to : `_out_${step.id}`;
        state = advanceWorkflowRun(state.run_id, stepNo + 1, {
          [outputTo]: toolResult,
        });
      } catch (toolErr) {
        if (onError === 'continue') {
          state = advanceWorkflowRun(state.run_id, stepNo + 1, {
            [`error_${step.id}`]: String(toolErr),
          });
          continue;
        }
        setWorkflowRunStatus(state.run_id, 'FAILED', String(toolErr));
        return { run_id: state.run_id, status: 'FAILED', detail: String(toolErr) };
      }
      continue;
    }

    // ── Agent step ───────────────────────────────────────────────────────────
    if (typeof step.agent === 'string') {
      const input = resolveInputFrom(ctx, step.input_from);
      try {
        const ar = await runAgent(step.agent, input, agentContext);

        if (ar.status === 'PENDING_APPROVAL') {
          setWorkflowRunStatus(state.run_id, 'WAITING_FOR_APPROVAL');
          return {
            run_id: state.run_id,
            status: 'WAITING_FOR_APPROVAL',
            detail: ar,
          };
        }

        if (ar.status === 'REFUSED' || ar.status === 'FAILED') {
          if (onError === 'continue') {
            state = advanceWorkflowRun(state.run_id, stepNo + 1, {
              [`error_${step.id}`]: ar.error,
            });
            continue;
          }
          setWorkflowRunStatus(state.run_id, 'FAILED', ar.error);
          return { run_id: state.run_id, status: 'FAILED', detail: ar };
        }

        const outputTo =
          typeof step.output_to === 'string' ? step.output_to : `_agent_${step.id}`;
        state = advanceWorkflowRun(state.run_id, stepNo + 1, {
          [outputTo]: ar.output,
        });
      } catch (agentErr) {
        if (onError === 'continue') {
          state = advanceWorkflowRun(state.run_id, stepNo + 1, {
            [`error_${step.id}`]: String(agentErr),
          });
          continue;
        }
        setWorkflowRunStatus(state.run_id, 'FAILED', String(agentErr));
        return { run_id: state.run_id, status: 'FAILED', detail: String(agentErr) };
      }
      continue;
    }

    // ── Unknown step type — skip ──────────────────────────────────────────────
    state = advanceWorkflowRun(state.run_id, stepNo + 1, {
      [`skipped_${step.id}`]: true,
    });
  }

  setWorkflowRunStatus(state.run_id, 'COMPLETED');
  const final = getWorkflowRun(state.run_id);
  return {
    run_id: state.run_id,
    status: 'COMPLETED',
    context: final?.context,
  };
}
