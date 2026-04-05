import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { WorkflowRunState } from '../types/agent.js';

function storePath(): { dir: string; file: string } {
  const dir = process.env.VELO_STATE_DIR ?? join(process.cwd(), '.velo');
  return { dir, file: join(dir, 'workflow-runs.json') };
}

let didHydrate = false;

export function hydrateWorkflowRuns(into: Map<string, WorkflowRunState>): void {
  if (didHydrate) return;
  didHydrate = true;
  try {
    const { file } = storePath();
    if (!existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, WorkflowRunState>;
    for (const [k, v] of Object.entries(data)) into.set(k, v);
  } catch {
    /* ignore */
  }
}

export function persistWorkflowRuns(from: Map<string, WorkflowRunState>): void {
  try {
    const { dir, file } = storePath();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(Object.fromEntries(from), null, 2), 'utf-8');
  } catch {
    /* ignore */
  }
}
