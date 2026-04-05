import type { AgentContext, AgentResult } from '@velo/core/types';
import { runAgent } from '../runner.js';

export async function runPayrollAgent(
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  return runAgent('payroll', input, context);
}
