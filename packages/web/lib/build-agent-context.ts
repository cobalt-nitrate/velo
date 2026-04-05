import type { AgentContext } from '@velo/core/types';

/** Builds AgentContext from API JSON (chat, workflows, resume). */
export function buildAgentContextFromBody(body: Record<string, unknown>): AgentContext {
  return {
    messages:
      Array.isArray(body.messages) && body.messages.length > 0
        ? (body.messages as AgentContext['messages'])
        : [],
    company_id: String(body.companyId ?? body.company_id ?? 'demo-company'),
    actor_id: String(body.actorId ?? body.actor_id ?? 'actor-anon'),
    actor_role: String(body.actorRole ?? body.actor_role ?? 'founder'),
    session_id: String(body.sessionId ?? body.session_id ?? `sess-${Date.now()}`),
    memory: (body.memory as Record<string, unknown>) ?? {},
    observations: [],
  };
}
