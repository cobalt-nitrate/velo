import type { WorkflowDefinition, WorkflowRunState } from '../types/agent.js';
import { hydrateWorkflowRuns, persistWorkflowRuns } from './persist.js';

const workflowRuns = new Map<string, WorkflowRunState>();

hydrateWorkflowRuns(workflowRuns);

function nowIso(): string {
  return new Date().toISOString();
}

export function startWorkflowRun(
  workflow: WorkflowDefinition,
  context: Record<string, unknown>
): WorkflowRunState {
  const run: WorkflowRunState = {
    workflow_id: workflow.id,
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
