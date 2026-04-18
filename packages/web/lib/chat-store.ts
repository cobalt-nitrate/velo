import 'server-only';
import { prisma } from './prisma';
import type { ChatMessage, ChatSession } from './chat-types';

export type { ChatArtifact, ChatMessage, ChatSession } from './chat-types';

// ── Internal helpers ──────────────────────────────────────────────────────────

function rowToSession(row: {
  id: string;
  title: string;
  agentId: string;
  companyId: string;
  actorRole: string;
  actorId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    attachments: unknown;
    artifacts: unknown;
    timestamp: Date;
  }>;
}): ChatSession {
  return {
    id: row.id,
    title: row.title,
    agentId: row.agentId,
    companyId: row.companyId,
    actorRole: row.actorRole,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages.map((m) => ({
      id: m.id,
      role: m.role as ChatMessage['role'],
      content: m.content,
      timestamp: m.timestamp.toISOString(),
      attachments: (m.attachments as ChatMessage['attachments']) ?? [],
      artifacts: (m.artifacts as ChatMessage['artifacts']) ?? [],
    })),
  };
}

const WITH_MESSAGES = { messages: { orderBy: { timestamp: 'asc' as const } } };

// ── Public API (mirrors the old file-based store, now async) ──────────────────

export async function listChatSessions(): Promise<
  Array<{ id: string; title: string; updatedAt: string; agentId: string }>
> {
  const rows = await prisma.chatSession.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true, agentId: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    agentId: r.agentId,
  }));
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const row = await prisma.chatSession.findUnique({
    where: { id },
    include: WITH_MESSAGES,
  });
  return row ? rowToSession(row) : null;
}

export async function createChatSession(params: {
  title?: string;
  agentId?: string;
  companyId?: string;
  actorId?: string;
  actorRole?: string;
}): Promise<ChatSession> {
  const row = await prisma.chatSession.create({
    data: {
      title: params.title?.trim() || 'New conversation',
      agentId: params.agentId ?? 'orchestrator',
      companyId: params.companyId ?? 'demo-company',
      actorId: params.actorId ?? 'web-user',
      actorRole: params.actorRole ?? 'founder',
    },
    include: WITH_MESSAGES,
  });
  return rowToSession(row);
}

export async function updateChatSessionMeta(
  id: string,
  patch: Partial<Pick<ChatSession, 'title' | 'agentId'>>
): Promise<ChatSession | null> {
  try {
    const row = await prisma.chatSession.update({
      where: { id },
      data: {
        ...(patch.title != null && { title: patch.title }),
        ...(patch.agentId != null && { agentId: patch.agentId }),
      },
      include: WITH_MESSAGES,
    });
    return rowToSession(row);
  } catch {
    return null;
  }
}

export async function appendChatExchange(params: {
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
}): Promise<ChatSession | null> {
  const session = await getChatSession(params.sessionId);
  if (!session) return null;

  // Auto-title from first user message
  const needsTitle = session.title === 'New conversation' && params.userMessage.content.trim();
  const newTitle = needsTitle
    ? params.userMessage.content.trim().slice(0, 52) +
      (params.userMessage.content.length > 52 ? '…' : '')
    : undefined;

  const messagesToCreate = [params.userMessage, ...(params.assistantMessage ? [params.assistantMessage] : [])];

  await prisma.$transaction([
    ...messagesToCreate.map((m) =>
      prisma.chatMessage.create({
        data: {
          sessionId: params.sessionId,
          role: m.role,
          content: m.content,
          attachments: (m.attachments ?? []) as object[],
          artifacts: (m.artifacts ?? []) as object[],
          timestamp: new Date(m.timestamp),
        },
      })
    ),
    prisma.chatSession.update({
      where: { id: params.sessionId },
      data: { ...(newTitle && { title: newTitle }) },
    }),
  ]);

  return getChatSession(params.sessionId);
}

export async function deleteChatSession(id: string): Promise<boolean> {
  try {
    await prisma.chatSession.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
