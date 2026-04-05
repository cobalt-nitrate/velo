import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runHelpdeskAgent(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('helpdesk', input, context);
}
