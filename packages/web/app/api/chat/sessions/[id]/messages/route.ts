import { buildAttachmentContext } from '@/lib/attachment-context';
import {
  appendChatExchange,
  getChatSession,
} from '@/lib/chat-store';
import type { ChatArtifact, ChatMessage } from '@/lib/chat-types';
import { getUpload } from '@/lib/upload-store';
import { runAgent } from '@velo/agents';
import type { AgentContext } from '@velo/core/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = getChatSession(params.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = (await req.json()) as {
      text?: string;
      agentId?: string;
      uploadIds?: string[];
    };
    const text = String(body.text ?? '').trim();
    const uploadIds = Array.isArray(body.uploadIds) ? body.uploadIds : [];
    if (!text && uploadIds.length === 0) {
      return NextResponse.json(
        { error: 'text or uploadIds required' },
        { status: 400 }
      );
    }

    const agentId = String(body.agentId ?? session.agentId);
    const { block, previews } = buildAttachmentContext(uploadIds);
    const fullInput = (text || '(see attachments)') + block;

    const attachmentMeta = uploadIds
      .map((id) => {
        const u = getUpload(id);
        return u
          ? {
              id,
              name: u.name,
              url: `/api/uploads/${id}`,
              mime: u.mime,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const now = new Date().toISOString();
    const userArtifacts: ChatArtifact[] = previews.map((p) => ({
      id: nid('art'),
      kind: 'parsed_preview',
      title: `Preview · ${p.name}`,
      body: p.snippet,
      createdAt: now,
    }));

    const userMsg: ChatMessage = {
      id: nid('usr'),
      role: 'user',
      content: text || '(attachment only)',
      timestamp: now,
      attachments: attachmentMeta.length ? attachmentMeta : undefined,
      artifacts: userArtifacts.length ? userArtifacts : undefined,
    };

    const ctxMessages: AgentContext['messages'] = session.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    }));

    const context: AgentContext = {
      messages: ctxMessages,
      company_id: session.companyId,
      actor_id: session.actorId,
      actor_role: session.actorRole,
      session_id: session.id,
      memory: {},
      observations: [],
    };

    const result = await runAgent(agentId, fullInput, context);

    const artifacts: ChatArtifact[] = [];
    if (result.status === 'PENDING_APPROVAL' && result.approval_request) {
      const ar = result.approval_request;
      artifacts.push({
        id: nid('apr'),
        kind: 'approval',
        title: 'Approval required',
        body: ar.proposed_action_text,
        payload: {
          approval_id: result.approval_id,
          action_type: ar.action_type,
          confidence: ar.confidence_score,
        },
        createdAt: new Date().toISOString(),
      });
    }
    if (result.error && result.status !== 'PENDING_APPROVAL') {
      artifacts.push({
        id: nid('err'),
        kind: 'error',
        title: 'Run failed',
        body: result.error,
        createdAt: new Date().toISOString(),
      });
    }
    if (result.status === 'COMPLETED' && result.output) {
      artifacts.push({
        id: nid('out'),
        kind: 'agent_output',
        title: 'Agent output',
        body:
          typeof result.output === 'string'
            ? result.output
            : JSON.stringify(result.output, null, 2),
        payload: {
          status: result.status,
          audit_entry_id: result.audit_entry_id,
        },
        createdAt: new Date().toISOString(),
      });
    }

    let assistantText = '';
    if (typeof result.output === 'string' && result.output.trim()) {
      assistantText = result.output;
    } else if (result.status === 'PENDING_APPROVAL') {
      assistantText =
        result.approval_request?.proposed_action_text ??
        'This action needs your approval in Velo.';
    } else if (result.error) {
      assistantText = result.error;
    } else {
      assistantText = JSON.stringify(result, null, 2);
    }

    const assistantMsg: ChatMessage = {
      id: nid('asst'),
      role: 'assistant',
      content: assistantText,
      timestamp: new Date().toISOString(),
      artifacts: artifacts.length ? artifacts : undefined,
    };

    appendChatExchange({
      sessionId: session.id,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    });

    const updated = getChatSession(session.id);
    return NextResponse.json({ ok: true, session: updated, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
