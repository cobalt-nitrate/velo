import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runComplianceAgent(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('compliance', input, context);
}
