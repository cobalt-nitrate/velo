import { runAgent } from '@velo/agents';
import { buildAgentContextFromBody } from '@/lib/build-agent-context';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const agentId = String(body.agentId ?? 'helpdesk');
    const input = body.input ?? body.message ?? body.prompt ?? '';

    const result = await runAgent(agentId, input, buildAgentContextFromBody(body));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
