import { runAgent } from '@velo/agents';
import type { AgentContext } from '@velo/core/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function buildContext(body: Record<string, unknown>): AgentContext {
  return {
    messages:
      Array.isArray(body.messages) && body.messages.length > 0
        ? (body.messages as AgentContext['messages'])
        : [],
    company_id: String(body.companyId ?? 'demo-company'),
    actor_id: String(body.actorId ?? 'actor-anon'),
    actor_role: String(body.actorRole ?? 'founder'),
    session_id: String(body.sessionId ?? `sess-${Date.now()}`),
    memory: (body.memory as Record<string, unknown>) ?? {},
    observations: [],
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const agentId = String(body.agentId ?? 'helpdesk');
    const input = body.input ?? body.message ?? body.prompt ?? '';

    const result = await runAgent(agentId, input, buildContext(body));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
