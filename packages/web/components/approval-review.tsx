'use client';

import { isApprovalPendingStatus } from '@velo/tools/data/approval-status';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type EvidenceResponse = {
  ok: boolean;
  error?: string;
  approval_id: string;
  agent_id: string;
  action_type: string;
  status: string;
  confidence_score: string;
  sections: Array<{
    id: string;
    title: string;
    items: Array<{ kind: string; label: string; value: string; source?: string }>;
  }>;
  signal_scores: Array<{ signal: string; score: number; detail: string }>;
};

type HistoryResponse = {
  ok: boolean;
  error?: string;
  approval_id: string;
  events: Array<{
    id: string;
    type: string;
    actor_id: string;
    actor_role: string;
    notes: string;
    payload: unknown;
    created_at: string;
  }>;
};

export function ApprovalReview({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<Record<string, string> | null>(
    null
  );
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [tab, setTab] = useState<'evidence' | 'history'>('evidence');
  const [historyQuery, setHistoryQuery] = useState('');
  const autoResolved = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/approvals/${encodeURIComponent(approvalId)}`);
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          setError(String(data.error ?? res.statusText));
          return;
        }
        const row = data.approval as Record<string, string> | undefined;
        if (!cancelled) setApproval(row ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approvalId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ev, hist] = await Promise.all([
          fetch(`/api/approvals/${encodeURIComponent(approvalId)}/evidence`),
          fetch(`/api/approvals/${encodeURIComponent(approvalId)}/history`),
        ]);
        const evData = (await ev.json()) as EvidenceResponse;
        const histData = (await hist.json()) as HistoryResponse;
        if (!cancelled) {
          if (evData?.ok) setEvidence(evData);
          if (histData?.ok) setHistory(histData);
        }
      } catch {
        // Evidence/history are best-effort; core review still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [approvalId]);

  async function resolve(resolution: 'APPROVED' | 'REJECTED') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(approvalId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution,
          resolution_notes: notes,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(String(data.error ?? res.statusText));
        return;
      }
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    setResubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(approvalId)}/resubmit`, {
        method: 'POST',
      });
      const data = (await res.json()) as { ok: boolean; approval_id?: string; error?: string };
      if (!res.ok || !data.ok || !data.approval_id) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.replace(`/approvals/${encodeURIComponent(data.approval_id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResubmitting(false);
    }
  }

  useEffect(() => {
    if (autoResolved.current || !approval || !isApprovalPendingStatus(approval.status)) return;
    const r = searchParams.get('resolve');
    if (r === 'approved' || r === 'rejected') {
      autoResolved.current = true;
      void resolve(r === 'approved' ? 'APPROVED' : 'REJECTED');
    }
  }, [searchParams, approval]);

  if (loading) {
    return (
      <p className="p-6 text-sm text-velo-muted">Loading approval…</p>
    );
  }

  if (error && !approval) {
    return (
      <p className="p-6 text-sm text-rose-700">{error}</p>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-6 pb-24 sm:pb-6">
      <h1 className="text-xl font-semibold">Approval</h1>
      <p className="mt-1 font-mono text-xs text-velo-muted">{approvalId}</p>
      {approval && (
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-velo-muted">Status</dt>
            <dd className="flex items-center gap-2">
              <span>{approval.status}</span>
              {String(approval.status ?? '').toUpperCase() === 'EXPIRED' && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Expired
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-velo-muted">Action</dt>
            <dd>{approval.action_type}</dd>
          </div>
          <div>
            <dt className="text-velo-muted">Proposed</dt>
            <dd className="whitespace-pre-wrap">{approval.proposed_action_text}</dd>
          </div>
        </dl>
      )}

      {String(approval?.status ?? '').toUpperCase() === 'EXPIRED' && (
        <section className="mt-4 rounded-xl border border-amber-300/40 bg-amber-50/10 p-3 text-xs text-velo-muted">
          <p className="font-medium text-velo-text">This approval expired</p>
          <p className="mt-1">You can resubmit it to create a fresh approval request with a new expiry.</p>
          <button
            type="button"
            onClick={() => void resubmit()}
            disabled={resubmitting}
            className="mt-2 rounded-md bg-velo-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {resubmitting ? 'Resubmitting…' : 'Resubmit approval'}
          </button>
        </section>
      )}

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('evidence')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === 'evidence'
              ? 'bg-teal-50 text-velo-text ring-1 ring-velo-accent/40'
              : 'text-velo-muted hover:bg-velo-inset hover:text-velo-text'
          }`}
        >
          Evidence
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === 'history'
              ? 'bg-teal-50 text-velo-text ring-1 ring-velo-accent/40'
              : 'text-velo-muted hover:bg-velo-inset hover:text-velo-text'
          }`}
        >
          History
        </button>
      </div>

      {tab === 'evidence' && evidence?.ok && (
        <section className="mt-3 rounded-xl border border-velo-line bg-velo-panel p-4">
          <h2 className="text-sm font-semibold text-velo-text">Evidence</h2>
          {evidence.signal_scores.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-velo-muted">Confidence breakdown</p>
              <ul className="mt-2 space-y-1 text-xs text-velo-muted">
                {evidence.signal_scores.map((s) => (
                  <li key={s.signal} className="flex items-center justify-between gap-3">
                    <span className="font-mono">{s.signal}</span>
                    <span className="font-mono">{(s.score * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(evidence.sections ?? []).map((sec) => (
            <div key={sec.id} className="mt-4">
              <p className="text-xs font-medium text-velo-muted">{sec.title}</p>
              <dl className="mt-2 grid gap-x-3 gap-y-2 rounded-lg bg-velo-inset p-3 text-[11px]">
                {sec.items.map((it, idx) => (
                  <div
                    key={`${sec.id}_${idx}`}
                    className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr] sm:gap-3"
                  >
                    <dt className="text-velo-muted">{it.label}</dt>
                    <dd className="text-velo-text whitespace-pre-wrap">
                      {it.value || '—'}
                      {it.source ? (
                        <span className="ml-2 text-[10px] text-velo-muted/70">({it.source})</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}

      {tab === 'history' && (
        <section className="mt-3 rounded-xl border border-velo-line bg-velo-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-velo-text">History</h2>
            <input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              placeholder="Search (type, actor, notes)…"
              className="w-full rounded-md border border-velo-line bg-velo-inset px-2 py-1.5 text-xs text-velo-text placeholder-velo-muted/60 sm:w-64"
            />
          </div>
          {history?.ok && history.events.length > 0 ? (
            <ol className="mt-3 space-y-2 text-xs text-velo-muted">
              {history.events
                .filter((e) => {
                  const q = historyQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    e.type.toLowerCase().includes(q) ||
                    e.actor_id.toLowerCase().includes(q) ||
                    e.notes.toLowerCase().includes(q)
                  );
                })
                .map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-velo-text">{e.type}</p>
                      {(e.actor_id || e.notes) && (
                        <p className="mt-0.5">
                          {e.actor_id ? <span className="font-mono">{e.actor_id}</span> : null}
                          {e.notes ? <span className="ml-2">{e.notes}</span> : null}
                        </p>
                      )}
                    </div>
                    <time className="shrink-0 font-mono text-[10px] text-velo-muted/80">
                      {new Date(e.created_at).toLocaleString()}
                    </time>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="mt-3 text-xs text-velo-muted">No history recorded yet.</p>
          )}
        </section>
      )}

      <label className="mt-4 block text-sm">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-2 py-2 text-sm"
          rows={3}
        />
      </label>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}

      <div className="mt-4 hidden gap-2 sm:flex">
        <button
          type="button"
          disabled={busy || !isApprovalPendingStatus(approval?.status)}
          onClick={() => resolve('APPROVED')}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy || !isApprovalPendingStatus(approval?.status)}
          onClick={() => resolve('REJECTED')}
          className="rounded-md bg-rose-600/80 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Reject
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-velo-line bg-velo-bg/90 p-4 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-lg gap-2 px-2">
          <button
            type="button"
            disabled={busy || !isApprovalPendingStatus(approval?.status)}
            onClick={() => resolve('APPROVED')}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy || !isApprovalPendingStatus(approval?.status)}
            onClick={() => resolve('REJECTED')}
            className="flex-1 rounded-md bg-rose-600/80 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </main>
  );
}
