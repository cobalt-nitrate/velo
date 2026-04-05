'use client';

import type { ChatArtifact, ChatMessage, ChatSession } from '@/lib/chat-types';
import { AgentLivePanel } from '@/components/agent-live-panel';
import { MarkdownBody } from '@/components/markdown-body';
import type { AgentRunEvent } from '@velo/agents';
import Link from 'next/link';
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const AGENTS = [
  { id: 'orchestrator', label: 'Orchestrator' },
  { id: 'helpdesk', label: 'Helpdesk' },
  { id: 'runway', label: 'Runway' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'ap-invoice', label: 'AP invoice' },
  { id: 'ar-collections', label: 'AR' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'hr', label: 'HR' },
] as const;

function ArtifactBlock({ a }: { a: ChatArtifact }) {
  const approvalId =
    a.kind === 'approval' &&
    a.payload &&
    typeof a.payload === 'object' &&
    'approval_id' in a.payload
      ? String((a.payload as { approval_id?: string }).approval_id ?? '')
      : '';

  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono uppercase text-[10px] text-velo-muted">
          {a.kind.replace(/_/g, ' ')}
        </span>
        <span className="font-medium text-velo-text">{a.title}</span>
      </div>
      {a.body && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-velo-muted">
          {a.body}
        </pre>
      )}
      {approvalId && (
        <Link
          href={`/approvals/${encodeURIComponent(approvalId)}`}
          className="mt-2 inline-block text-velo-accent hover:underline"
        >
          Open approval →
        </Link>
      )}
    </div>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === 'user';
  const artifacts = m.artifacts?.filter((a) => a.kind !== 'agent_output') ?? [];
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? 'bg-velo-accent/20 text-velo-text'
            : 'border border-velo-line bg-velo-panel text-velo-text'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide text-velo-muted">
          {m.role} · {new Date(m.timestamp).toLocaleString()}
        </div>
        {isUser ? (
          <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
        ) : (
          <MarkdownBody text={m.content} className="mt-1" />
        )}
        {m.attachments && m.attachments.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-velo-muted">
            {m.attachments.map((f) => (
              <li key={f.id}>
                <a href={f.url} className="text-velo-accent hover:underline" target="_blank" rel="noreferrer">
                  📎 {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
        {artifacts.map((a) => (
          <ArtifactBlock key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

export function ChatWorkspace() {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string; updatedAt: string; agentId: string }>
  >([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [agentId, setAgentId] = useState('orchestrator');
  const [text, setText] = useState('');
  const [pendingUploads, setPendingUploads] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [liveEvents, setLiveEvents] = useState<AgentRunEvent[]>([]);
  const [liveThought, setLiveThought] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(async () => {
    const res = await fetch('/api/chat/sessions');
    const data = (await res.json()) as { sessions?: typeof sessions };
    setSessions(data.sessions ?? []);
  }, []);

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/chat/sessions/${encodeURIComponent(id)}`);
    const data = (await res.json()) as { session?: ChatSession };
    if (data.session) {
      setSession(data.session);
      setAgentId(data.session.agentId);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingSessions(true);
      await refreshSessions();
      setLoadingSessions(false);
    })();
  }, [refreshSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length, liveEvents.length]);

  async function createSession(): Promise<ChatSession | null> {
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
    const data = (await res.json()) as { session?: ChatSession };
    if (data.session) {
      await refreshSessions();
      setSession(data.session);
      return data.session;
    }
    return null;
  }

  async function onUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = (await res.json()) as {
        upload?: { id: string; name: string };
      };
      if (data.upload) {
        setPendingUploads((p) => [...p, { id: data.upload!.id, name: data.upload!.name }]);
      }
    }
    e.target.value = '';
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t && pendingUploads.length === 0) return;

    let active = session;
    if (!active) {
      active = await createSession();
      if (!active) return;
    }

    setLiveEvents([]);
    setLiveThought('');
    setLoading(true);
    try {
      const res = await fetch(
        `/api/chat/sessions/${encodeURIComponent(active.id)}/messages/stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: t,
            agentId,
            uploadIds: pendingUploads.map((u) => u.id),
          }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        alert('Streaming not supported in this browser');
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let msg: {
            channel?: string;
            event?: AgentRunEvent;
            ok?: boolean;
            session?: ChatSession;
            error?: string;
          };
          try {
            msg = JSON.parse(line) as typeof msg;
          } catch {
            continue;
          }
          if (msg.channel === 'event' && msg.event) {
            setLiveEvents((prev) => [...prev, msg.event!]);
            if (msg.event.type === 'assistant.delta') {
              setLiveThought(
                (prev) =>
                  (prev ? `${prev}\n\n────────\n\n` : '') + (msg.event as { text: string }).text
              );
            }
          }
          if (msg.channel === 'done') {
            if (!msg.ok) {
              alert(msg.error ?? 'Run failed');
              return;
            }
            if (msg.session) setSession(msg.session);
            setText('');
            setPendingUploads([]);
            await refreshSessions();
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[480px]">
      <div className="flex w-56 shrink-0 flex-col border-r border-velo-line bg-velo-panel/50">
        <div className="border-b border-velo-line p-2">
          <button
            type="button"
            onClick={() => void createSession()}
            className="w-full rounded-lg bg-velo-accent py-2 text-sm font-medium text-black"
          >
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingSessions ? (
            <p className="text-xs text-velo-muted">Loading…</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void loadSession(s.id)}
                    className={`w-full rounded-md px-2 py-2 text-left text-xs ${
                      session?.id === s.id
                        ? 'bg-white/10 text-velo-text'
                        : 'text-velo-muted hover:bg-white/5'
                    }`}
                  >
                    <span className="line-clamp-2">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-velo-line px-4 py-3">
          <label className="text-xs text-velo-muted">
            Agent
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="ml-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-sm text-velo-text"
            >
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          {session && (
            <span className="text-[10px] text-velo-muted">
              Session <span className="font-mono">{session.id.slice(0, 12)}…</span>
            </span>
          )}
          <span className="text-[10px] text-velo-muted lg:hidden">Mission panel on wide screens</span>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!session ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-velo-muted">Start a new conversation or pick one from the left.</p>
                  <button
                    type="button"
                    onClick={() => void createSession()}
                    className="mt-4 rounded-lg bg-velo-accent px-4 py-2 text-sm font-medium text-black"
                  >
                    New chat
                  </button>
                </div>
              ) : (
                <div className="mx-auto flex max-w-3xl flex-col gap-4">
                  {session.messages.map((m) => (
                    <MessageBubble key={m.id} m={m} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <form
              onSubmit={onSend}
              className="border-t border-velo-line bg-velo-panel/80 px-4 py-3"
            >
              {pendingUploads.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingUploads.map((u) => (
                    <span
                      key={u.id}
                      className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-velo-muted"
                    >
                      {u.name}
                      <button
                        type="button"
                        className="ml-1 text-rose-300"
                        onClick={() =>
                          setPendingUploads((p) => p.filter((x) => x.id !== u.id))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mx-auto flex max-w-3xl gap-2">
                <label className="cursor-pointer rounded-lg border border-dashed border-velo-line px-3 py-2 text-xs text-velo-muted hover:border-velo-accent hover:text-velo-accent">
                  Attach
                  <input type="file" multiple className="hidden" onChange={onUploadFile} />
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Message Velo… (policies, runway, invoices — attachments welcome)"
                  rows={2}
                  className="min-h-[44px] flex-1 resize-y rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-velo-accent/50"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-velo-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                >
                  {loading ? '…' : 'Send'}
                </button>
              </div>
            </form>
          </div>

          <AgentLivePanel
            events={liveEvents}
            liveThought={liveThought}
            running={loading}
            className="hidden w-[min(42vw,420px)] shrink-0 border-l lg:flex"
          />
        </div>
      </div>
    </div>
  );
}
