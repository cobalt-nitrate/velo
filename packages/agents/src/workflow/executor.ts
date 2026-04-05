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

export async function runWorkflowLinear(
  workflowKey: string,
  initialContext: Record<string, unknown>,
  agentContext: AgentContext
): Promise<{ run_id: string; status: string; context?: Record<string, unknown>; detail?: unknown }> {
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

    if (step.action === 'tool_call' && typeof step.tool === 'string') {
      const input = resolveInputFrom(ctx, step.input_from);
      const toolResult = await invokeRegisteredTool(step.tool, {
        ...input,
        company_id: agentContext.company_id,
      });
      const outputTo =
        typeof step.output_to === 'string' ? step.output_to : `_out_${step.id}`;
      state = advanceWorkflowRun(state.run_id, stepNo + 1, {
        [outputTo]: toolResult,
      });
      continue;
    }

    if (typeof step.agent === 'string') {
      const input = resolveInputFrom(ctx, step.input_from);
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
        setWorkflowRunStatus(state.run_id, 'FAILED', ar.error);
        return { run_id: state.run_id, status: 'FAILED', detail: ar };
      }
      const outputTo =
        typeof step.output_to === 'string' ? step.output_to : `_agent_${step.id}`;
      state = advanceWorkflowRun(state.run_id, stepNo + 1, {
        [outputTo]: ar.output,
      });
      continue;
    }

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
