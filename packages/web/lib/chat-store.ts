import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ChatMessage, ChatSession } from './chat-types';
import { chatsDir, veloDataDir } from './velo-data-dir';

export type { ChatArtifact, ChatMessage, ChatSession } from './chat-types';

interface IndexFile {
  sessions: Array<{
    id: string;
    title: string;
    updatedAt: string;
    agentId: string;
  }>;
}

function indexPath(): string {
  return join(chatsDir(), '_index.json');
}

function sessionPath(id: string): string {
  return join(chatsDir(), `${id}.json`);
}

function readIndex(): IndexFile {
  const p = indexPath();
  if (!existsSync(p)) return { sessions: [] };
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as IndexFile;
  } catch {
    return { sessions: [] };
  }
}

function writeIndex(idx: IndexFile): void {
  writeFileSync(indexPath(), JSON.stringify(idx, null, 2), 'utf-8');
}

export function listChatSessions(): IndexFile['sessions'] {
  return readIndex().sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getChatSession(id: string): ChatSession | null {
  const p = sessionPath(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as ChatSession;
  } catch {
    return null;
  }
}

function writeSession(session: ChatSession): void {
  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
  const idx = readIndex();
  const i = idx.sessions.findIndex((s) => s.id === session.id);
  const meta = {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    agentId: session.agentId,
  };
  if (i >= 0) idx.sessions[i] = meta;
  else idx.sessions.unshift(meta);
  writeIndex(idx);
}

export function createChatSession(params: {
  title?: string;
  agentId?: string;
  companyId?: string;
  actorId?: string;
  actorRole?: string;
}): ChatSession {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const session: ChatSession = {
    id,
    title: params.title?.trim() || 'New conversation',
    agentId: params.agentId ?? 'orchestrator',
    companyId: params.companyId ?? 'demo-company',
    actorId: params.actorId ?? 'web-user',
    actorRole: params.actorRole ?? 'founder',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  writeSession(session);
  return session;
}

export function updateChatSessionMeta(
  id: string,
  patch: Partial<Pick<ChatSession, 'title' | 'agentId'>>
): ChatSession | null {
  const s = getChatSession(id);
  if (!s) return null;
  if (patch.title != null) s.title = patch.title;
  if (patch.agentId != null) s.agentId = patch.agentId;
  s.updatedAt = new Date().toISOString();
  writeSession(s);
  return s;
}

export function appendChatExchange(params: {
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
}): ChatSession | null {
  const s = getChatSession(params.sessionId);
  if (!s) return null;
  s.messages.push(params.userMessage);
  if (params.assistantMessage) s.messages.push(params.assistantMessage);
  s.updatedAt = new Date().toISOString();
  if (s.title === 'New conversation' && params.userMessage.content.trim()) {
    s.title =
      params.userMessage.content.trim().slice(0, 52) +
      (params.userMessage.content.length > 52 ? '…' : '');
  }
  writeSession(s);
  return s;
}

export function deleteChatSession(id: string): boolean {
  const p = sessionPath(id);
  if (!existsSync(p)) return false;
  try {
    unlinkSync(p);
  } catch {
    return false;
  }
  const idx = readIndex();
  idx.sessions = idx.sessions.filter((s) => s.id !== id);
  writeIndex(idx);
  return true;
}

/** Settings stored beside chats (company UI prefs). */
export function settingsPath(): string {
  return join(veloDataDir(), 'ui-settings.json');
}
