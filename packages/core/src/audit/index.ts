export interface AuditEvent {
  id: string;
  timestamp: string;
  company_id: string;
  actor_id: string;
  actor_role: string;
  agent_id: string;
  event_type:
    | 'AGENT_STARTED'
    | 'TOOL_PROPOSED'
    | 'POLICY_DECISION'
    | 'TOOL_EXECUTED'
    | 'APPROVAL_REQUESTED'
    | 'AGENT_COMPLETED'
    | 'AGENT_FAILED';
  payload: Record<string, unknown>;
}

const auditStore = new Map<string, AuditEvent>();

export function createAuditEvent(
  input: Omit<AuditEvent, 'id' | 'timestamp'>
): AuditEvent {
  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };

  auditStore.set(event.id, event);
  return event;
}

export function getAuditEvent(eventId: string): AuditEvent | undefined {
  return auditStore.get(eventId);
}

export function listAuditEventsByCompany(companyId: string): AuditEvent[] {
  return Array.from(auditStore.values()).filter(
    (event) => event.company_id === companyId
  );
}
