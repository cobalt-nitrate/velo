// AuditLogger — append-only event trail.
// Events are stored in-memory for fast access within a session.
// Flush to VELO_LOGS.audit_trail via @velo/tools `appendAuditRow`: serialized queue +
// exponential backoff on Google quota errors (still fire-and-forget from this module).

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

const MAX_AUDIT_STORE = 2_000;
const auditStore = new Map<string, AuditEvent>();

function evictOldestAuditEvents(): void {
  if (auditStore.size <= MAX_AUDIT_STORE) return;
  const toDelete = auditStore.size - MAX_AUDIT_STORE;
  let deleted = 0;
  for (const key of auditStore.keys()) {
    if (deleted >= toDelete) break;
    auditStore.delete(key);
    deleted++;
  }
}

/** Row writer from `@velo/tools/sheets` `appendAuditRow` — register via `registerAuditSheetsFlush` from agents (or any host that has tools). */
let sheetsFlushFn: ((row: Record<string, unknown>) => Promise<void>) | null = null;

/**
 * Wire Sheets audit persistence. Call once from `@velo/agents` (or another package that depends on `@velo/tools`).
 * `@velo/core` stays free of a tools dependency so Next/Webpack can bundle it without resolving `@velo/tools/sheets`.
 */
export function registerAuditSheetsFlush(
  fn: ((row: Record<string, unknown>) => Promise<void>) | null
): void {
  sheetsFlushFn = fn;
}

async function flushToSheets(event: AuditEvent): Promise<void> {
  try {
    if (sheetsFlushFn) {
      await sheetsFlushFn({
        entry_id: event.id,
        timestamp: event.timestamp,
        actor_id: event.actor_id,
        actor_role: event.actor_role,
        agent_id: event.agent_id,
        action_type: event.event_type,
        module: event.agent_id,
        record_id: String(event.payload.tool_id ?? event.payload.session_id ?? ''),
        old_value_json: '',
        new_value_json: JSON.stringify(event.payload),
        status: event.event_type.includes('FAILED') ? 'FAILED' : 'OK',
        session_id: String(event.payload.session_id ?? ''),
      });
    }
  } catch {
    // Never let audit flush failure propagate — it's observability, not execution
  }
}

export function createAuditEvent(
  input: Omit<AuditEvent, 'id' | 'timestamp'>
): AuditEvent {
  const event: AuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...input,
  };

  auditStore.set(event.id, event);
  evictOldestAuditEvents();

  // Fire-and-forget DB flush — never awaited so it never blocks the agent
  void flushToSheets(event);

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

export function listAuditEventsBySession(sessionId: string): AuditEvent[] {
  return Array.from(auditStore.values()).filter(
    (event) => event.payload.session_id === sessionId
  );
}
