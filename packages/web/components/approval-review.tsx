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
  action_payload: Record<string, unknown>;
  evidence_items: unknown[];
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
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">Approval</h1>
      <p className="mt-1 font-mono text-xs text-velo-muted">{approvalId}</p>
      {approval && (
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-velo-muted">Status</dt>
            <dd>{approval.status}</dd>
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

      {evidence?.ok && (
        <section className="mt-6 rounded-xl border border-velo-line bg-velo-panel p-4">
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
          <div className="mt-3">
            <p className="text-xs font-medium text-velo-muted">Items</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-velo-inset p-3 text-[11px] text-velo-muted">
              {JSON.stringify(evidence.evidence_items ?? [], null, 2)}
            </pre>
          </div>
        </section>
      )}

      {history?.ok && history.events.length > 0 && (
        <section className="mt-6 rounded-xl border border-velo-line bg-velo-panel p-4">
          <h2 className="text-sm font-semibold text-velo-text">History</h2>
          <ol className="mt-3 space-y-2 text-xs text-velo-muted">
            {history.events.map((e) => (
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
      <div className="mt-4 flex gap-2">
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
    </main>
  );
}
