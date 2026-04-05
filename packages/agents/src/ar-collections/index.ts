import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runArCollectionsAgent(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('ar-collections', input, context);
}
