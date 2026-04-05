import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runOrchestrator(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('orchestrator', input, context);
}
