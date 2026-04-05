import type { WorkflowDefinition, WorkflowRunState } from '../types/agent.js';
import {
  hydrateWorkflowRuns,
  persistWorkflowRuns,
  readWorkflowRunsSnapshot,
} from './persist.js';

const workflowRuns = new Map<string, WorkflowRunState>();

hydrateWorkflowRuns(workflowRuns);

function nowIso(): string {
  return new Date().toISOString();
}

/** Merge disk state into the in-memory map (Next.js / worker process refresh). */
export function syncWorkflowRunsFromDisk(): void {
  const snap = readWorkflowRunsSnapshot();
  for (const [id, run] of Object.entries(snap)) {
    workflowRuns.set(id, run);
  }
}

export function startWorkflowRun(
  workflow: WorkflowDefinition,
  context: Record<string, unknown>,
  workflowConfigKey: string
): WorkflowRunState {
  const run: WorkflowRunState = {
    workflow_id: workflow.id,
    workflow_config_key: workflowConfigKey,
    run_id: `wf_${workflow.id}_${Date.now()}`,
    status: 'RUNNING',
    current_step: 1,
    context,
    started_at: nowIso(),
    updated_at: nowIso(),
  };

  workflowRuns.set(run.run_id, run);
  persistWorkflowRuns(workflowRuns);
  return run;
}

export function setWorkflowAwaitingApproval(
  runId: string,
  pending: {
    approval_id: string;
    tool_id: string;
    tool_parameters: Record<string, unknown>;
  }
): WorkflowRunState {
  const run = workflowRuns.get(runId);
  if (!run) {
    throw new Error(`Workflow run not found: ${runId}`);
  }
  const updated: WorkflowRunState = {
    ...run,
    status: 'WAITING_FOR_APPROVAL',
    pending_approval_id: pending.approval_id,
    pending_tool_id: pending.tool_id,
    pending_tool_params: pending.tool_parameters,
    updated_at: nowIso(),
  };
  workflowRuns.set(runId, updated);
  persistWorkflowRuns(workflowRuns);
  return updated;
}

export function clearWorkflowPendingApproval(runId: string): void {
  const run = workflowRuns.get(runId);
  if (!run) return;
  delete run.pending_approval_id;
  delete run.pending_tool_id;
  delete run.pending_tool_params;
  run.updated_at = nowIso();
  workflowRuns.set(runId, run);
  persistWorkflowRuns(workflowRuns);
}

export { readWorkflowRunsSnapshot } from './persist.js';

export function advanceWorkflowRun(
  runId: string,
  nextStep: number,
  partialContext?: Record<string, unknown>
): WorkflowRunState {
  const run = workflowRuns.get(runId);
  if (!run) {
    throw new Error(`Workflow run not found: ${runId}`);
  }

  const updated: WorkflowRunState = {
    ...run,
    current_step: nextStep,
    context: {
      ...run.context,
      ...(partialContext ?? {}),
    },
    updated_at: nowIso(),
  };

  workflowRuns.set(runId, updated);
  persistWorkflowRuns(workflowRuns);
  return updated;
}

export function setWorkflowRunStatus(
  runId: string,
  status: WorkflowRunState['status'],
  error?: string
): WorkflowRunState {
  const run = workflowRuns.get(runId);
  if (!run) {
    throw new Error(`Workflow run not found: ${runId}`);
  }

  const updated: WorkflowRunState = {
    ...run,
    status,
    error,
    updated_at: nowIso(),
  };

  workflowRuns.set(runId, updated);
  persistWorkflowRuns(workflowRuns);
  return updated;
}

export function getWorkflowRun(runId: string): WorkflowRunState | undefined {
  return workflowRuns.get(runId);
}
