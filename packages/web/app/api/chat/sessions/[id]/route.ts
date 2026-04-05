import {
  deleteChatSession,
  getChatSession,
  updateChatSessionMeta,
} from '@/lib/chat-store';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = getChatSession(params.id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, session });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const session = updateChatSessionMeta(params.id, {
      title: typeof body.title === 'string' ? body.title : undefined,
      agentId: typeof body.agentId === 'string' ? body.agentId : undefined,
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, session });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ok = deleteChatSession(params.id);
  if (!ok) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
