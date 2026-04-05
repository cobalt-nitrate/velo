import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runHrAgent(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('hr', input, context);
}
