'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { APPROVAL_MODULE_LABEL, classifyApprovalModule, type ApprovalModuleFilter } from '@/lib/operations-triage';

type ApprovalRow = {
  approval_id: string;
  agent_id: string;
  action_type: string;
  proposed_action_text: string;
  confidence_score: string;
  created_at: string;
  expires_at: string;
  status: string;
  approver_role: string;
};

type ApprovalsResponse = {
  ok: boolean;
  error?: string;
  approvals: ApprovalRow[];
};

function toNum(x: string): number {
  const n = Number(String(x ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'ANY'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export function ApprovalsInbox() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [module, setModule] = useState<ApprovalModuleFilter>('all');
  const [sort, setSort] = useState<'created_at' | 'confidence'>('created_at');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkThreshold, setBulkThreshold] = useState('0.90');

  const filtered = useMemo(() => {
    const base =
      module === 'all'
        ? rows
        : rows.filter((r) => classifyApprovalModule(r.agent_id, r.action_type) === module);

    const sorted = [...base].sort((a, b) => {
      if (sort === 'confidence') {
        const da = toNum(a.confidence_score);
        const db = toNum(b.confidence_score);
        return order === 'desc' ? db - da : da - db;
      }
      const da = a.created_at ?? '';
      const db = b.created_at ?? '';
      return order === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

    return sorted;
  }, [rows, module, sort, order]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/approvals', window.location.origin);
      url.searchParams.set('limit', '100');
      url.searchParams.set('status', status);
      const res = await fetch(url.toString());
      const data = (await res.json()) as ApprovalsResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows(data.approvals ?? []);
      setSelected({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((m) => ({ ...m, [id]: !m[id] }));
  }

  function toggleAllPending() {
    const pending = filtered.filter((r) => String(r.status ?? '').toUpperCase() === 'PENDING');
    const allSelected = pending.every((r) => selected[r.approval_id]);
    setSelected((m) => {
      const next = { ...m };
      for (const r of pending) next[r.approval_id] = !allSelected;
      return next;
    });
  }

  async function bulkApprove() {
    setBulkError(null);
    const threshold = Math.max(0, Math.min(1, Number(bulkThreshold)));
    if (!Number.isFinite(threshold)) {
      setBulkError('Invalid threshold.');
      return;
    }
    const ids = selectedIds;
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/approvals/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_ids: ids, min_confidence: threshold, notes: 'bulk_approve' }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-velo-text">Approvals</h1>
          <p className="mt-1 text-sm text-velo-muted">Filter, review, and resolve approvals from agents.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm font-medium text-velo-text hover:bg-velo-inset"
        >
          Refresh
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-velo-line bg-velo-panel p-3">
        <label className="text-xs font-medium text-velo-muted">
          Status
          <select
            className="ml-2 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <span className="mx-1 h-5 w-px bg-velo-line" />

        <span className="text-xs font-medium uppercase tracking-wide text-velo-muted">
          Module
        </span>
        {(
          ['all', 'ap', 'ar', 'payroll', 'hr', 'compliance', 'runway', 'helpdesk', 'other'] as const
        ).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setModule(id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              module === id
                ? 'bg-velo-accent text-white'
                : 'border border-velo-line bg-velo-panel text-velo-muted hover:text-velo-text'
            }`}
          >
            {APPROVAL_MODULE_LABEL[id]}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-velo-line" />

        <label className="text-xs font-medium text-velo-muted">
          Sort
          <select
            className="ml-2 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'created_at' | 'confidence')}
          >
            <option value="created_at">created_at</option>
            <option value="confidence">confidence</option>
          </select>
        </label>

        <label className="text-xs font-medium text-velo-muted">
          Order
          <select
            className="ml-2 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text"
            value={order}
            onChange={(e) => setOrder(e.target.value as 'desc' | 'asc')}
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </label>
      </div>

      <section className="mt-5 rounded-xl border border-velo-line bg-velo-panel p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-velo-muted">
            <button
              type="button"
              onClick={toggleAllPending}
              className="rounded-md border border-velo-line bg-velo-inset px-2 py-1 font-medium text-velo-text hover:bg-velo-inset/60"
            >
              Toggle all pending
            </button>
            <span>{selectedIds.length} selected</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-velo-muted">
              Min confidence
              <input
                value={bulkThreshold}
                onChange={(e) => setBulkThreshold(e.target.value)}
                className="ml-2 w-20 rounded-md border border-velo-line bg-velo-inset px-2 py-1 font-mono text-xs text-velo-text"
              />
            </label>
            <button
              type="button"
              disabled={bulkBusy || selectedIds.length === 0}
              onClick={() => void bulkApprove()}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {bulkBusy ? 'Approving…' : 'Bulk approve'}
            </button>
          </div>
        </div>
        {bulkError && <p className="mt-2 text-xs font-medium text-rose-700">{bulkError}</p>}
      </section>

      {error && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-velo-muted">Loading…</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-velo-line">
          <table className="min-w-full divide-y divide-velo-line text-left text-sm">
            <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
              <tr>
                <th className="px-3 py-2.5"> </th>
                <th className="px-3 py-2.5">Module</th>
                <th className="px-3 py-2.5">Approval ID</th>
                <th className="px-3 py-2.5">Agent</th>
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-velo-line/80 text-velo-text">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-velo-muted">
                    No approvals match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const mod = classifyApprovalModule(r.agent_id, r.action_type);
                  const pending = String(r.status ?? '').toUpperCase() === 'PENDING';
                  return (
                    <tr key={r.approval_id} className="hover:bg-velo-inset/70">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!pending}
                          checked={!!selected[r.approval_id]}
                          onChange={() => toggle(r.approval_id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-velo-muted">{APPROVAL_MODULE_LABEL[mod]}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.approval_id}</td>
                      <td className="px-3 py-2 text-velo-muted">{r.agent_id}</td>
                      <td className="px-3 py-2 text-velo-muted">{r.action_type}</td>
                      <td className="px-3 py-2 text-velo-muted">{r.confidence_score}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-velo-muted">{r.created_at}</td>
                      <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/approvals/${encodeURIComponent(r.approval_id)}`}
                          className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-[11px] font-semibold text-velo-text hover:bg-velo-inset"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

