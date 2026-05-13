import { getCompanyMemory } from '@velo/core';
import type { AgentContext } from '@velo/core/types';

/** Builds AgentContext from API JSON (chat, workflows, resume). */
export function buildAgentContextFromBody(body: Record<string, unknown>): AgentContext {
  const companyId = String(body.companyId ?? body.company_id ?? 'demo-company');
  const mem = getCompanyMemory(companyId);
  return {
    messages:
      Array.isArray(body.messages) && body.messages.length > 0
        ? (body.messages as AgentContext['messages'])
        : [],
    company_id: companyId,
    actor_id: String(body.actorId ?? body.actor_id ?? 'actor-anon'),
    actor_role: String(body.actorRole ?? body.actor_role ?? 'founder'),
    session_id: String(body.sessionId ?? body.session_id ?? `sess-${Date.now()}`),
    memory: mem ? (mem as unknown as Record<string, unknown>) : ((body.memory as Record<string, unknown>) ?? {}),
    observations: [],
  };
}
