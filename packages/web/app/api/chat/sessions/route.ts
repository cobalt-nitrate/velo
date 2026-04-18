import { createChatSession, listChatSessions } from '@/lib/chat-store';
import { getUiSettings } from '@/lib/local-settings';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const sessions = await listChatSessions();
  return NextResponse.json({ ok: true, sessions });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const defaults = await getUiSettings();
    const session = await createChatSession({
      title: typeof body.title === 'string' ? body.title : undefined,
      agentId: typeof body.agentId === 'string' ? body.agentId : defaults.defaultAgentId,
      companyId: typeof body.companyId === 'string' ? body.companyId : 'demo-company',
      actorId: typeof body.actorId === 'string' ? body.actorId : 'web-user',
      actorRole: typeof body.actorRole === 'string' ? body.actorRole : defaults.defaultActorRole,
    });
    return NextResponse.json({ ok: true, session });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
