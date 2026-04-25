'use client';

import type { ChatArtifact, ChatMessage, ChatSession } from '@/lib/chat-types';
import { consumeOperationsChatHandoff } from '@/lib/operations-chat-handoff';
import {
  buildApprovedMissionUserPrompt,
  type OperationsMissionPlanResponse,
} from '@/lib/operations-mission-plan';
import { AgentLivePanel } from '@/components/agent-live-panel';
import { MarkdownBody } from '@/components/markdown-body';
import { OperationsMissionBriefing } from '@/components/operations-mission-briefing';
import { IconChevronRight, IconPaperclip } from '@/components/velo-icons';
import type { AgentRunEvent } from '@velo/agents';
import { isApprovalPendingStatus } from '@velo/tools/data/approval-status';
import Link from 'next/link';
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type ChatPayload = { text: string; agentId: string; uploadIds: string[] };

function formatArtifactKind(kind: string | undefined) {
  return String(kind ?? 'note').replace(/_/g, ' ');
}

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

function ApprovalArtifactBlock({ a, approvalId }: { a: ChatArtifact; approvalId: string }) {
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      try {
        const res = await fetch(`/api/approvals/${encodeURIComponent(approvalId)}`);
        const data = (await res.json()) as {
          approval?: { status?: string };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setLiveError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        setLiveError(null);
        setLiveStatus(data.approval?.status ?? null);
      } catch (e) {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : 'Could not load status');
      }
    }
    void fetchOnce();
    const iv = setInterval(() => void fetchOnce(), 12_000);
    function onVis() {
      if (document.visibilityState === 'visible') void fetchOnce();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [approvalId]);

  const resolved =
    liveStatus !== null && liveStatus !== undefined && !isApprovalPendingStatus(liveStatus);

  return (
    <div className="mt-2 rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-velo-inset-deep px-1.5 py-0.5 font-mono uppercase text-[10px] text-velo-muted">
          {formatArtifactKind(a.kind)}
        </span>
        <span className="font-medium text-velo-text">{a.title ?? 'Approval'}</span>
      </div>
      {resolved && (
        <p className="mt-2 font-medium text-emerald-700">
          Current status: <span className="font-mono">{liveStatus}</span>
        </p>
      )}
      {liveError && <p className="mt-2 text-rose-700">{liveError}</p>}
      {a.body && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-velo-muted">
          {a.body}
        </pre>
      )}
      <Link
        href={`/approvals/${encodeURIComponent(approvalId)}`}
        className="mt-2 inline-flex items-center gap-1 text-velo-accent hover:underline"
      >
        Open approval
        <IconChevronRight size={14} className="shrink-0 opacity-80" aria-hidden />
      </Link>
    </div>
  );
}

function ArtifactBlock({ a }: { a: ChatArtifact }) {
  const approvalId =
    a.kind === 'approval' &&
    a.payload &&
    typeof a.payload === 'object' &&
    'approval_id' in a.payload
      ? String((a.payload as { approval_id?: string }).approval_id ?? '').trim()
      : '';

  if (a.kind === 'approval' && approvalId) {
    return <ApprovalArtifactBlock a={a} approvalId={approvalId} />;
  }

  return (
    <div className="mt-2 rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-velo-inset-deep px-1.5 py-0.5 font-mono uppercase text-[10px] text-velo-muted">
          {formatArtifactKind(a.kind)}
        </span>
        <span className="font-medium text-velo-text">{a.title ?? 'Artifact'}</span>
      </div>
      {a.body && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-velo-muted">
          {a.body}
        </pre>
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
            ? 'border border-teal-200/80 bg-teal-50/90 text-velo-text'
            : 'border border-velo-line bg-velo-panel shadow-sm text-velo-text'
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
                <a
                  href={f.url}
                  className="inline-flex items-center gap-1.5 text-velo-accent hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  <IconPaperclip size={14} className="shrink-0 opacity-85" aria-hidden />
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
        {artifacts.map((a, i) => (
          <ArtifactBlock key={a.id ?? `artifact-${i}`} a={a} />
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendInfo, setSendInfo] = useState<string | null>(null);
  const [missionPlan, setMissionPlan] = useState<OperationsMissionPlanResponse | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [missionApproveBusy, setMissionApproveBusy] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  function isLikelyNetworkFailure(err: unknown): boolean {
    if (err instanceof TypeError) return true;
    if (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message)) {
      return true;
    }
    return false;
  }

  const refreshSessions = useCallback(async () => {
    setSessionsError(null);
    try {
      const res = await fetch('/api/chat/sessions');
      const data = (await res.json()) as { sessions?: typeof sessions; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Could not load sessions (HTTP ${res.status}).`);
      }
      setSessions(data.sessions ?? []);
    } catch (e) {
      setSessions([]);
      setSessionsError(
        e instanceof Error ? e.message : 'Could not reach /api/chat/sessions — is the dev server running?'
      );
    }
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${encodeURIComponent(id)}`);
      const data = (await res.json().catch(() => ({}))) as { session?: ChatSession; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Could not load session (HTTP ${res.status}).`);
      }
      if (data.session) {
        setSession(data.session);
        setAgentId(data.session.agentId);
      }
    } catch (e) {
      setSendError(
        e instanceof Error
          ? e.message
          : 'Could not reach /api/chat/sessions/[id] — is the dev server running?'
      );
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
    const h = consumeOperationsChatHandoff();
    if (!h) return;
    setMissionPlan(null);
    setMissionError(null);
    setMissionLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/chat/operations-mission-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: h.domain, row: h.row }),
        });
        const data = (await res.json()) as OperationsMissionPlanResponse & {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || data.ok !== true) {
          throw new Error(data.error ?? `Mission plan failed (${res.status})`);
        }
        setMissionPlan(data);
        setAgentId('orchestrator');
      } catch (e) {
        setMissionError(e instanceof Error ? e.message : String(e));
      } finally {
        setMissionLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, liveEvents.length, missionPlan, missionLoading]);

  useEffect(() => {
    const sid = session?.id;
    if (!sid) return;
    const sessionId = sid;
    function onVis() {
      if (document.visibilityState === 'visible') void loadSession(sessionId);
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [session?.id, loadSession]);

  async function createSession(opts?: {
    title?: string;
    agentId?: string;
  }): Promise<ChatSession | null> {
    const aid = opts?.agentId ?? agentId;
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: aid, title: opts?.title }),
    });
    const data = (await res.json()) as { session?: ChatSession };
    if (data.session) {
      await refreshSessions();
      setSession(data.session);
      setAgentId(data.session.agentId);
      return data.session;
    }
    return null;
  }

  const runChatPayload = useCallback(
    async (active: ChatSession, payload: ChatPayload, clearComposer: boolean) => {
      const streamUrl = `/api/chat/sessions/${encodeURIComponent(active.id)}/messages/stream`;
      const jsonUrl = `/api/chat/sessions/${encodeURIComponent(active.id)}/messages`;

      setLiveEvents([]);
      setLiveThought('');
      setSendError(null);
      setSendInfo(null);
      setLoading(true);

      const runStream = async () => {
        const res = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Streaming request failed (${res.status})`);
        }
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error('Streaming is not supported in this browser.');
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
              setLiveThought('');
              if (!msg.ok) {
                throw new Error(msg.error ?? 'Agent run failed.');
              }
              if (msg.session) setSession(msg.session);
              if (clearComposer) {
                setText('');
                setPendingUploads([]);
              }
              await refreshSessions();
            }
          }
        }
      };

      const runJsonFallback = async () => {
        const res = await fetch(jsonUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          session?: ChatSession;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `Chat request failed (${res.status})`);
        }
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.session) setSession(data.session);
        if (clearComposer) {
          setText('');
          setPendingUploads([]);
        }
        setLiveEvents([]);
        setLiveThought('');
        await refreshSessions();
      };

      try {
        await runStream();
      } catch (err) {
        if (isLikelyNetworkFailure(err)) {
          try {
            await runJsonFallback();
            setSendInfo(
              'Streaming was unavailable, so this reply was loaded without the live mission-control feed. Check the dev server and network if this keeps happening.'
            );
            return;
          } catch (fallbackErr) {
            throw fallbackErr;
          }
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refreshSessions]
  );

  function dismissMissionBriefing() {
    setMissionPlan(null);
    setMissionError(null);
    setMissionLoading(false);
  }

  async function onApproveMission() {
    if (!missionPlan) return;
    setMissionApproveBusy(true);
    setSendError(null);
    setSendInfo(null);
    try {
      setAgentId('orchestrator');
      let active = session;
      if (!active) {
        active = await createSession({
          title: missionPlan.mission_title,
          agentId: 'orchestrator',
        });
      }
      if (!active) {
        throw new Error('Could not open a chat session.');
      }
      const prompt = buildApprovedMissionUserPrompt(missionPlan);
      await runChatPayload(
        active,
        { text: prompt, agentId: 'orchestrator', uploadIds: [] },
        true
      );
      setMissionPlan(null);
      setMissionError(null);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setMissionApproveBusy(false);
    }
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
      try {
        active = await createSession();
      } catch {
        setSendError(
          'Could not create a chat session. Check that the dev server is running and try again.'
        );
        return;
      }
      if (!active) return;
    }

    // Optimistic render: show the user's message immediately in the main pane,
    // instead of waiting for the server to return the updated session.
    const optimisticUserMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: t,
      timestamp: new Date().toISOString(),
    };
    setSession((prev) => {
      if (!prev || prev.id !== active!.id) return prev ?? active!;
      return {
        ...prev,
        messages: [...(prev.messages ?? []), optimisticUserMsg],
        updatedAt: new Date().toISOString(),
      };
    });
    setText('');
    setPendingUploads([]);

    const payload: ChatPayload = {
      text: t,
      agentId,
      uploadIds: pendingUploads.map((u) => u.id),
    };

    try {
      await runChatPayload(active, payload, true);
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : 'Something went wrong while sending.'
      );
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (loading || missionApproveBusy) return;
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden md:min-h-0 md:flex-row">
      <div className="flex max-h-[min(38vh,22rem)] min-h-0 w-full shrink-0 flex-col border-b border-velo-line bg-velo-panel-muted/90 md:max-h-none md:h-full md:w-56 md:border-b-0 md:border-r">
        <div className="shrink-0 border-b border-velo-line p-2">
          <button
            type="button"
            onClick={() => void createSession()}
            className="w-full rounded-lg bg-velo-accent py-2 text-sm font-medium text-white shadow-soft hover:bg-velo-accent-hover"
          >
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessionsError && (
            <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] leading-snug text-rose-900">
              {sessionsError}
            </p>
          )}
          {loadingSessions ? (
            <p className="text-xs text-velo-muted">Loading…</p>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-velo-line/60 p-4 text-center">
              <p className="text-[11px] font-medium text-velo-muted">No conversations yet</p>
              <p className="text-[10px] text-velo-muted/70">
                Ask the orchestrator agent anything — payroll, invoices, compliance, HR.
              </p>
              <button
                type="button"
                onClick={() => void createSession()}
                className="mt-1 rounded-md bg-velo-accent/10 px-3 py-1.5 text-[11px] font-semibold text-velo-accent hover:bg-velo-accent/20"
              >
                Start first chat
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void loadSession(s.id)}
                    className={`w-full rounded-md px-2 py-2 text-left text-xs ${
                      session?.id === s.id
                        ? 'bg-velo-inset text-velo-text'
                        : 'text-velo-muted hover:bg-velo-inset/80'
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
              className="ml-1 rounded border border-velo-line bg-velo-inset px-2 py-1 text-sm text-velo-text"
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
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <OperationsMissionBriefing
                  plan={missionPlan}
                  loading={missionLoading}
                  error={missionError}
                  approving={missionApproveBusy}
                  onApprove={() => void onApproveMission()}
                  onDismiss={dismissMissionBriefing}
                />
                {!session ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-velo-line/80 py-10 text-center">
                    <p className="max-w-lg text-sm text-velo-muted">
                      {missionPlan || missionLoading || missionError
                        ? 'Review the mission briefing above, then approve to start the run.'
                        : 'Type a message below to start — a session will be created automatically.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {(session.messages ?? []).map((m) => (
                      <MessageBubble key={m.id} m={m} />
                    ))}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            </div>

            <form
              onSubmit={onSend}
              className="border-t border-velo-line bg-velo-panel px-4 py-3 shadow-[0_-4px_24px_-12px_rgba(15,23,42,0.06)]"
            >
              {sendError && (
                <div
                  className="mx-auto mb-2 flex max-w-3xl items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900"
                  role="alert"
                >
                  <span>{sendError}</span>
                  <button
                    type="button"
                    className="shrink-0 text-rose-600 hover:text-rose-900"
                    onClick={() => setSendError(null)}
                    aria-label="Dismiss error"
                  >
                    ×
                  </button>
                </div>
              )}
              {sendInfo && (
                <div className="mx-auto mb-2 flex max-w-3xl items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  <span>{sendInfo}</span>
                  <button
                    type="button"
                    className="shrink-0 text-amber-700 hover:text-amber-950"
                    onClick={() => setSendInfo(null)}
                    aria-label="Dismiss notice"
                  >
                    ×
                  </button>
                </div>
              )}
              {pendingUploads.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingUploads.map((u) => (
                    <span
                      key={u.id}
                      className="rounded-md bg-velo-inset px-2 py-1 text-[11px] text-velo-muted"
                    >
                      {u.name}
                      <button
                        type="button"
                        className="ml-1 text-rose-600"
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
                  onKeyDown={onComposerKeyDown}
                  placeholder="Message Velo… (policies, runway, invoices — attachments welcome)"
                  rows={2}
                  className="min-h-[44px] flex-1 resize-y rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm outline-none ring-offset-velo-bg focus:border-velo-accent focus:ring-2 focus:ring-velo-accent/20"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-velo-accent px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-velo-accent-hover disabled:opacity-50"
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
