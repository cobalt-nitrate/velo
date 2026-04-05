/**
 * Phase 2 — shared entity contract helpers (see docs/v1/module-flows.md).
 */

import type { PolicyResult, VeloModuleId, VeloWorkflowEntityBase } from './types/agent.js';

export function inferModuleFromAgentId(agentId: string): VeloModuleId {
  const a = agentId.toLowerCase();
  if (a.includes('ap-invoice') || a === 'ap') return 'ap';
  if (a.includes('ar') || a.includes('collections')) return 'ar';
  if (a.includes('payroll')) return 'payroll';
  if (a.includes('compliance')) return 'compliance';
  if (a.includes('runway')) return 'runway';
  if (a.includes('helpdesk')) return 'helpdesk';
  if (a.includes('hr')) return 'hr';
  if (a.includes('orchestrator')) return 'system';
  return 'system';
}

export function buildWorkflowEntityStub(input: {
  id: string;
  agentId: string;
  confidence: number;
  policyResult: PolicyResult;
  ownerRole: VeloWorkflowEntityBase['owner_role'];
  evidenceRefs?: string[];
  auditEntryId?: string;
}): VeloWorkflowEntityBase {
  return {
    id: input.id,
    module: inferModuleFromAgentId(input.agentId),
    status: mapPolicyToEntityStatus(input.policyResult),
    confidence: input.confidence,
    policy_result: input.policyResult,
    owner_role: input.ownerRole,
    evidence_refs: input.evidenceRefs ?? [],
    audit_entry_id: input.auditEntryId,
    updated_at: new Date().toISOString(),
  };
}

function mapPolicyToEntityStatus(
  p: PolicyResult
): VeloWorkflowEntityBase['status'] {
  switch (p) {
    case 'AUTO_EXECUTE':
      return 'IN_PROGRESS';
    case 'REQUEST_APPROVAL':
      return 'WAITING_APPROVAL';
    case 'RECOMMEND_ONLY':
      return 'IN_PROGRESS';
    case 'REFUSE':
      return 'BLOCKED';
    default:
      return 'IN_PROGRESS';
  }
}
