'use client';

import { isApprovalPendingStatus } from '@velo/tools/sheets/approval-status';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function ApprovalReview({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<Record<string, string> | null>(
    null
  );
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
