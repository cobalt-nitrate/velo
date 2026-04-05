import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runApInvoiceAgent(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('ap-invoice', input, context);
}
