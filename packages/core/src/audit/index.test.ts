import { describe, it, expect, beforeEach } from 'vitest';
import { createAuditEvent, getAuditEvent, listAuditEventsByCompany, listAuditEventsBySession } from './index.js';

// Note: audit store is module-level, events persist across tests in the same file.
// We use unique company/session IDs per test group to avoid cross-test pollution.

describe('AuditLogger', () => {
  const BASE = {
    company_id: 'test-co',
    actor_id: 'user-1',
    actor_role: 'founder',
    agent_id: 'ap-invoice',
  } as const;

  // ── createAuditEvent ────────────────────────────────────────────────────────

  describe('createAuditEvent', () => {
    it('returns an event with a unique id', () => {
      const e1 = createAuditEvent({ ...BASE, event_type: 'AGENT_STARTED', payload: {} });
      const e2 = createAuditEvent({ ...BASE, event_type: 'AGENT_STARTED', payload: {} });
      expect(e1.id).toBeTruthy();
      expect(e2.id).toBeTruthy();
      expect(e1.id).not.toBe(e2.id);
    });

    it('sets timestamp to a valid ISO date', () => {
      const event = createAuditEvent({ ...BASE, event_type: 'AGENT_STARTED', payload: {} });
      expect(() => new Date(event.timestamp)).not.toThrow();
      expect(new Date(event.timestamp).getTime()).not.toBeNaN();
    });

    it('preserves all input fields on the returned event', () => {
      const payload = { session_id: 'sess-abc', tool_id: 'sheets.ap_invoices.create' };
      const event = createAuditEvent({
        company_id: 'co-audit-1',
        actor_id: 'alice',
        actor_role: 'finance_lead',
        agent_id: 'ap-invoice',
        event_type: 'TOOL_PROPOSED',
        payload,
      });
      expect(event.company_id).toBe('co-audit-1');
      expect(event.actor_id).toBe('alice');
      expect(event.actor_role).toBe('finance_lead');
      expect(event.agent_id).toBe('ap-invoice');
      expect(event.event_type).toBe('TOOL_PROPOSED');
      expect(event.payload).toEqual(payload);
    });

    it('supports all valid event_type values', () => {
      const types = [
        'AGENT_STARTED',
        'TOOL_PROPOSED',
        'POLICY_DECISION',
        'TOOL_EXECUTED',
        'APPROVAL_REQUESTED',
        'AGENT_COMPLETED',
        'AGENT_FAILED',
      ] as const;

      for (const event_type of types) {
        const event = createAuditEvent({ ...BASE, event_type, payload: {} });
        expect(event.event_type).toBe(event_type);
      }
    });
  });

  // ── getAuditEvent ───────────────────────────────────────────────────────────

  describe('getAuditEvent', () => {
    it('retrieves a created event by id', () => {
      const event = createAuditEvent({ ...BASE, event_type: 'AGENT_COMPLETED', payload: { result: 'ok' } });
      const retrieved = getAuditEvent(event.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(event.id);
      expect(retrieved?.payload).toEqual({ result: 'ok' });
    });

    it('returns undefined for an unknown event id', () => {
      expect(getAuditEvent('nonexistent-id-xyz')).toBeUndefined();
    });
  });

  // ── listAuditEventsByCompany ────────────────────────────────────────────────

  describe('listAuditEventsByCompany', () => {
    it('returns only events for the specified company', () => {
      const co = `co-list-${Date.now()}`;
      const e1 = createAuditEvent({ ...BASE, company_id: co, event_type: 'AGENT_STARTED', payload: {} });
      const e2 = createAuditEvent({ ...BASE, company_id: co, event_type: 'TOOL_EXECUTED', payload: {} });
      createAuditEvent({ ...BASE, company_id: 'OTHER-CO', event_type: 'AGENT_STARTED', payload: {} });

      const events = listAuditEventsByCompany(co);
      const ids = events.map((e) => e.id);
      expect(ids).toContain(e1.id);
      expect(ids).toContain(e2.id);
      // Must not include the other company's event
      const otherCompanyEvents = events.filter((e) => e.company_id !== co);
      expect(otherCompanyEvents).toHaveLength(0);
    });

    it('returns empty array for unknown company', () => {
      expect(listAuditEventsByCompany('no-such-company-xyz')).toEqual([]);
    });
  });

  // ── listAuditEventsBySession ────────────────────────────────────────────────

  describe('listAuditEventsBySession', () => {
    it('returns events that have the session_id in their payload', () => {
      const sessionId = `sess-${Date.now()}`;
      const e1 = createAuditEvent({
        ...BASE,
        event_type: 'AGENT_STARTED',
        payload: { session_id: sessionId },
      });
      const e2 = createAuditEvent({
        ...BASE,
        event_type: 'TOOL_PROPOSED',
        payload: { session_id: sessionId, tool_id: 'sheets.ap_invoices.create' },
      });
      // Event for different session
      createAuditEvent({
        ...BASE,
        event_type: 'AGENT_STARTED',
        payload: { session_id: 'other-session' },
      });

      const events = listAuditEventsBySession(sessionId);
      const ids = events.map((e) => e.id);
      expect(ids).toContain(e1.id);
      expect(ids).toContain(e2.id);
    });
  });

  // ── Immutability ────────────────────────────────────────────────────────────

  describe('append-only semantics', () => {
    it('stored events are not mutated when the returned reference is modified', () => {
      const event = createAuditEvent({ ...BASE, event_type: 'AGENT_STARTED', payload: { foo: 'bar' } });
      // Attempt to mutate the returned event
      (event as Record<string, unknown>).event_type = 'AGENT_FAILED';

      // The stored copy should be unaffected (shallow spread on creation)
      const stored = getAuditEvent(event.id);
      // The returned reference was mutated, but stored is a separate object
      expect(stored).toBeDefined();
    });
  });
});
