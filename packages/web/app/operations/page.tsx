'use client';

import { OperationsTriagePanel } from '@/components/operations-triage-panel';
import {
  APPROVAL_MODULE_LABEL,
  type ApprovalModuleFilter,
  classifyApprovalModule,
  type OpsTriageDomain,
} from '@/lib/operations-triage';
import type {
  ActiveEmployeeSummary,
  ApPayableSummary,
  ArReceivableSummary,
  BankTransactionSummary,
  ComplianceObligationSummary,
  HrTaskSummary,
  OperationalSnapshot,
  PendingApprovalDetail,
} from '@velo/tools/platform-health';
import { EmptyState } from '@/components/empty-state';
import Link from 'next/link';
import { useCallback, useLayoutEffect, useState } from 'react';

const OPS_SNAPSHOT_STORAGE_KEY = 'velo.operations.snapshot.v1';

function formatInr(amount: string): string {
  const n = parseFloat(String(amount).replace(/,/g, ''));
  if (Number.isNaN(n)) return amount || '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

function DueCell({ days }: { days: number | null }) {
  if (days === null) return <span className="text-velo-muted">—</span>;
  if (days < 0) {
    return <span className="font-medium text-amber-800">{Math.abs(days)}d overdue</span>;
  }
  if (days === 0) return <span className="text-velo-muted">due today</span>;
  return <span className="text-velo-muted/90">in {days}d</span>;
}

function TriageCta({
  row,
  onOpen,
}: {
  row: Record<string, unknown>;
  onOpen: (r: Record<string, unknown>) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen({ ...row })}
      className="whitespace-nowrap rounded-md border border-velo-accent/35 bg-velo-accent/[0.12] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-velo-accent hover:bg-velo-accent/20"
    >
      Triage
    </button>
  );
}

export default function OperationsPage() {
  const [tab, setTab] = useState<OpsTriageDomain>('approvals');
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runway, setRunway] = useState<{
    balance_inr: number;
    as_of_date: string | null;
    burn_monthly_inr: number;
    runway_months: number | null;
  } | null>(null);
  const [apAging, setApAging] = useState<{
    buckets: Record<string, { count: number; total_inr: number }>;
  } | null>(null);
  const [arCollections, setArCollections] = useState<{
    total_outstanding_inr: number;
    avg_days_to_collect: number | null;
    top_overdue: Array<{ client_name: string; invoice_number: string; total_amount: string; overdue_days: number }>;
  } | null>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageRow, setTriageRow] = useState<Record<string, unknown> | null>(null);
  const [approvalModuleFilter, setApprovalModuleFilter] =
    useState<ApprovalModuleFilter>('all');
  const [bankQuery, setBankQuery] = useState('');
  const [bankFrom, setBankFrom] = useState('');
  const [bankTo, setBankTo] = useState('');
  const [bankType, setBankType] = useState('');
  const [bankRowsLive, setBankRowsLive] = useState<BankTransactionSummary[] | null>(null);
  const [bankCursor, setBankCursor] = useState<string | null>(null);
  const [bankLiveLoading, setBankLiveLoading] = useState(false);
  const [complianceMonth, setComplianceMonth] = useState<number>(() => new Date().getUTCMonth() + 1);
  const [complianceYear, setComplianceYear] = useState<number>(() => new Date().getUTCFullYear());
  const [complianceDays, setComplianceDays] = useState<Record<string, Array<Record<string, string>>> | null>(null);

  const openTriage = useCallback((r: Record<string, unknown>) => {
    setTriageRow(r);
    setTriageOpen(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, runwayRes, apAgingRes, arCollRes] = await Promise.all([
        fetch('/api/operations/snapshot'),
        fetch('/api/operations/runway'),
        fetch('/api/operations/ap-aging'),
        fetch('/api/operations/ar-collections'),
      ]);

      const snapData = (await snapRes.json()) as {
        ok?: boolean;
        operational_snapshot?: OperationalSnapshot;
        error?: string;
      };
      if (!snapRes.ok || !snapData.operational_snapshot) {
        throw new Error(snapData.error ?? `HTTP ${snapRes.status}`);
      }
      setSnapshot(snapData.operational_snapshot);

      try {
        const r = (await runwayRes.json()) as Record<string, unknown>;
        if (runwayRes.ok && r.ok) {
          setRunway({
            balance_inr: Number(r.balance_inr ?? 0),
            as_of_date: (r.as_of_date as string | null) ?? null,
            burn_monthly_inr: Number(r.burn_monthly_inr ?? 0),
            runway_months: (r.runway_months as number | null) ?? null,
          });
        } else setRunway(null);
      } catch {
        setRunway(null);
      }
      try {
        const a = (await apAgingRes.json()) as Record<string, unknown>;
        if (apAgingRes.ok && a.ok && a.buckets) {
          setApAging({ buckets: a.buckets as Record<string, { count: number; total_inr: number }> });
        } else setApAging(null);
      } catch {
        setApAging(null);
      }
      try {
        const c = (await arCollRes.json()) as Record<string, unknown>;
        if (arCollRes.ok && c.ok) {
          setArCollections({
            total_outstanding_inr: Number(c.total_outstanding_inr ?? 0),
            avg_days_to_collect: (c.avg_days_to_collect as number | null) ?? null,
            top_overdue: Array.isArray(c.top_overdue) ? (c.top_overdue as any) : [],
          });
        } else setArCollections(null);
      } catch {
        setArCollections(null);
      }
      try {
        sessionStorage.setItem(
          OPS_SNAPSHOT_STORAGE_KEY,
          JSON.stringify({ snapshot: snapData.operational_snapshot }),
        );
      } catch {
        // ignore quota / private mode
      }
    } catch (e) {
      setSnapshot(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(OPS_SNAPSHOT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { snapshot?: OperationalSnapshot };
        if (parsed?.snapshot && typeof parsed.snapshot === 'object') {
          setSnapshot(parsed.snapshot);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore corrupt cache
    }
    void load();
  }, [load]);

  const approvals: PendingApprovalDetail[] = snapshot?.pending_approvals ?? [];
  const filteredApprovals =
    approvalModuleFilter === 'all'
      ? approvals
      : approvals.filter(
          (r) =>
            classifyApprovalModule(r.agent_id, r.action_type) === approvalModuleFilter
        );
  const complianceRows: ComplianceObligationSummary[] = snapshot?.compliance_upcoming ?? [];
  const apRows: ApPayableSummary[] = snapshot?.ap_payables_detail ?? [];
  const arOpen: ArReceivableSummary[] = snapshot?.ar_receivables_detail ?? [];
  const arOd: ArReceivableSummary[] = snapshot?.ar_overdue_detail ?? [];
  const bankRows: BankTransactionSummary[] = snapshot?.bank_transactions_detail ?? [];
  const loadBankLive = useCallback(
    async (cursor: string | null) => {
      setBankLiveLoading(true);
      try {
        const url = new URL('/api/operations/bank-transactions', window.location.origin);
        if (bankQuery.trim()) url.searchParams.set('query', bankQuery.trim());
        if (bankFrom.trim()) url.searchParams.set('from', bankFrom.trim());
        if (bankTo.trim()) url.searchParams.set('to', bankTo.trim());
        if (bankType.trim()) url.searchParams.set('type', bankType.trim());
        url.searchParams.set('limit', '50');
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url.toString());
        const data = (await res.json()) as any;
        if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        const mapped: BankTransactionSummary[] = (data.rows ?? []).map((r: any) => ({
          txn_id: String(r.txn_id ?? ''),
          date: String(r.date ?? ''),
          narration: String(r.narration ?? ''),
          amount: String(r.amount ?? ''),
          balance: String(r.balance ?? ''),
          type: String(r.type ?? ''),
          mode: String(r.mode ?? ''),
        }));
        setBankRowsLive(cursor ? [...(bankRowsLive ?? []), ...mapped] : mapped);
        setBankCursor(data.next_cursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBankLiveLoading(false);
      }
    },
    [bankQuery, bankFrom, bankTo, bankType, bankRowsLive]
  );

  const loadComplianceCalendar = useCallback(async () => {
    try {
      const url = new URL('/api/operations/compliance-calendar', window.location.origin);
      url.searchParams.set('month', String(complianceMonth));
      url.searchParams.set('year', String(complianceYear));
      const res = await fetch(url.toString());
      const data = (await res.json()) as any;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setComplianceDays(data.days ?? {});
    } catch {
      setComplianceDays(null);
    }
  }, [complianceMonth, complianceYear]);

  const teamRows: ActiveEmployeeSummary[] = snapshot?.employees_detail ?? [];
  const hireRows: HrTaskSummary[] = snapshot?.hr_pending_hires_detail ?? [];
  const hrRows: HrTaskSummary[] = snapshot?.hr_blockers_detail ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-velo-text">Operations</h1>
          <p className="mt-1 max-w-2xl text-sm text-velo-muted">
            Live operational data — same structured rows the assistant should cite for approvals,
            compliance, AP, AR, bank activity, headcount, and HR blockers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm font-medium text-velo-text shadow-sm hover:bg-velo-inset"
          >
            Refresh
          </button>
          <Link
            href="/chat"
            className="rounded-lg bg-velo-accent px-3 py-2 text-sm font-medium text-white shadow-soft ring-1 ring-velo-accent/20 hover:bg-velo-accent-hover"
          >
            Open chat
          </Link>
        </div>
      </div>

      {snapshot?.data_source === 'unavailable' && (
        <EmptyState
          heading="Database not reachable"
          body="Operations data is read from PostgreSQL. Set DATABASE_URL, run migrations, and ensure the database is running — then refresh or complete onboarding."
          actions={[
            { label: 'Open setup wizard', href: '/onboarding', primary: true },
            { label: 'Go to Settings', href: '/settings' },
          ]}
        />
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {loading && !snapshot && (
        <p className="text-sm text-velo-muted">Loading operational snapshot…</p>
      )}

      {snapshot && (
        <>
          <section className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-velo-line bg-velo-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-velo-muted">Runway</p>
              <p className="mt-1 text-2xl font-semibold text-velo-text">
                {runway?.runway_months != null ? `${runway.runway_months.toFixed(1)} mo` : '—'}
              </p>
              <p className="mt-1 text-xs text-velo-muted">
                Balance: {runway?.balance_inr != null ? `₹${Math.round(runway.balance_inr).toLocaleString('en-IN')}` : '—'}
                {runway?.as_of_date ? ` · as of ${runway.as_of_date}` : ''}
              </p>
              <p className="mt-1 text-xs text-velo-muted">
                Burn (est.): {runway?.burn_monthly_inr != null ? `₹${Math.round(runway.burn_monthly_inr).toLocaleString('en-IN')}/mo` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-velo-line bg-velo-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-velo-muted">AP aging (overdue)</p>
              <div className="mt-2 space-y-1 text-xs text-velo-muted">
                <div className="flex items-center justify-between">
                  <span>0–30</span>
                  <span className="font-mono">{apAging?.buckets?.['0-30']?.count ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>31–60</span>
                  <span className="font-mono">{apAging?.buckets?.['31-60']?.count ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>60+</span>
                  <span className="font-mono">{apAging?.buckets?.['60+']?.count ?? '—'}</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-velo-muted/80">Counts exclude paid/cancelled.</p>
            </div>

            <div className="rounded-xl border border-velo-line bg-velo-panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-velo-muted">AR collections</p>
              <p className="mt-1 text-2xl font-semibold text-velo-text">
                {arCollections ? `₹${Math.round(arCollections.total_outstanding_inr).toLocaleString('en-IN')}` : '—'}
              </p>
              <p className="mt-1 text-xs text-velo-muted">
                Avg days to collect: {arCollections?.avg_days_to_collect != null ? arCollections.avg_days_to_collect : '—'}
              </p>
              {arCollections?.top_overdue?.length ? (
                <p className="mt-2 text-[11px] text-velo-muted/80">
                  Top overdue: {arCollections.top_overdue[0]?.client_name} ({arCollections.top_overdue[0]?.overdue_days}d)
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-velo-muted/80">Top overdue: —</p>
              )}
            </div>
          </section>

          <div className="mb-4 flex flex-wrap gap-2 border-b border-velo-line pb-3">
            {(
              [
                ['approvals', `Approvals (${approvals.length})`] as const,
                ['compliance', `Compliance (${complianceRows.length})`] as const,
                ['ap', `Open AP (${snapshot.open_ap_payables})`] as const,
                ['ar_open', `AR open (${snapshot.open_ar_receivables})`] as const,
                ['ar_overdue', `AR overdue (${snapshot.ar_overdue})`] as const,
                ['bank', `Bank (${snapshot.bank_txn_count})`] as const,
                [
                  'team',
                  `Team (${snapshot.active_employees ?? teamRows.length})`,
                ] as const,
                ['hires', `HR · hires (${snapshot.hr_pending_hires})`] as const,
                ['hr', `HR blockers (${snapshot.hr_open_blockers})`] as const,
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as OpsTriageDomain)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-teal-50 text-velo-text ring-1 ring-velo-accent/40'
                    : 'text-velo-muted hover:bg-velo-inset hover:text-velo-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'approvals' && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-velo-muted">
                  Module
                </span>
                {(
                  [
                    'all',
                    'ap',
                    'ar',
                    'payroll',
                    'hr',
                    'compliance',
                    'runway',
                    'helpdesk',
                    'other',
                  ] as const
                ).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setApprovalModuleFilter(id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      approvalModuleFilter === id
                        ? 'bg-velo-accent text-white'
                        : 'border border-velo-line bg-velo-panel text-velo-muted hover:text-velo-text'
                    }`}
                  >
                    {APPROVAL_MODULE_LABEL[id]}
                  </button>
                ))}
                {approvalModuleFilter !== 'all' && (
                  <span className="text-xs text-velo-muted">
                    Showing {filteredApprovals.length} of {approvals.length}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-velo-line">
                <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                  <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                    <tr>
                      <th className="px-3 py-2.5">Module</th>
                      <th className="px-3 py-2.5">Approval ID</th>
                      <th className="px-3 py-2.5">Agent</th>
                      <th className="px-3 py-2.5">Action</th>
                      <th className="px-3 py-2.5">Confidence</th>
                      <th className="px-3 py-2.5">Created</th>
                      <th className="px-3 py-2.5">Proposed action</th>
                      <th className="px-3 py-2.5 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-velo-line/80 text-velo-text">
                    {approvals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-velo-muted">
                          No pending approvals.
                        </td>
                      </tr>
                    ) : filteredApprovals.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-velo-muted">
                          No approvals match this module filter.
                        </td>
                      </tr>
                    ) : (
                      filteredApprovals.map((r) => {
                        const mod = classifyApprovalModule(r.agent_id, r.action_type);
                        return (
                          <tr key={r.approval_id} className="hover:bg-velo-inset/70">
                            <td className="px-3 py-2 text-xs text-velo-muted">
                              {APPROVAL_MODULE_LABEL[mod]}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{r.approval_id}</td>
                            <td className="px-3 py-2 text-velo-muted">{r.agent_id}</td>
                            <td className="px-3 py-2 text-velo-muted">{r.action_type}</td>
                            <td className="px-3 py-2 text-velo-muted">{r.confidence_score}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-velo-muted">
                              {r.created_at}
                            </td>
                            <td className="max-w-md px-3 py-2" title={r.proposed_action_text}>
                              {r.proposed_action_text}
                            </td>
                            <td className="px-3 py-2 text-right align-middle">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Link
                                  href={`/approvals/${encodeURIComponent(r.approval_id)}`}
                                  className="whitespace-nowrap rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-[11px] font-semibold text-velo-text hover:bg-velo-inset"
                                >
                                  Review
                                </Link>
                                <TriageCta row={{ ...r }} onOpen={openTriage} />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'compliance' && (
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-velo-muted">
                  <span className="font-medium uppercase tracking-wide">Calendar</span>
                  <input
                    value={complianceYear}
                    onChange={(e) => setComplianceYear(Number(e.target.value))}
                    className="w-20 rounded-md border border-velo-line bg-velo-panel px-2 py-1 font-mono text-xs text-velo-text"
                  />
                  <input
                    value={complianceMonth}
                    onChange={(e) => setComplianceMonth(Number(e.target.value))}
                    className="w-14 rounded-md border border-velo-line bg-velo-panel px-2 py-1 font-mono text-xs text-velo-text"
                  />
                  <button
                    type="button"
                    onClick={() => void loadComplianceCalendar()}
                    className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                  >
                    Load month
                  </button>
                  <a
                    href={`/api/operations/export?domain=compliance`}
                    className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                  >
                    Export CSV
                  </a>
                </div>
              </div>

              {complianceDays && (
                <div className="mb-4 rounded-xl border border-velo-line bg-velo-panel p-3">
                  <div className="grid grid-cols-7 gap-2 text-[11px]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                      <div key={d} className="font-semibold text-velo-muted">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-2">
                    {(() => {
                      const first = new Date(Date.UTC(complianceYear, complianceMonth - 1, 1));
                      const startDow = (first.getUTCDay() + 6) % 7; // monday=0
                      const daysInMonth = new Date(Date.UTC(complianceYear, complianceMonth, 0)).getUTCDate();
                      const cells: Array<{ day: number | null; key: string }> = [];
                      for (let i = 0; i < startDow; i++) cells.push({ day: null, key: `pad_${i}` });
                      for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d_${d}` });
                      while (cells.length % 7 !== 0) cells.push({ day: null, key: `pad2_${cells.length}` });

                      return cells.map((c) => {
                        if (!c.day) return <div key={c.key} className="h-24 rounded-lg border border-velo-line/60 bg-velo-inset/30" />;
                        const iso = `${complianceYear}-${String(complianceMonth).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
                        const items = complianceDays[iso] ?? [];
                        return (
                          <div key={c.key} className="h-24 overflow-hidden rounded-lg border border-velo-line bg-velo-panel p-2">
                            <div className="text-[10px] font-semibold text-velo-muted">{c.day}</div>
                            <div className="mt-1 space-y-1">
                              {items.slice(0, 3).map((it) => (
                                <div
                                  key={it.calendar_id}
                                  title={it.label}
                                  className="truncate rounded bg-velo-inset px-1.5 py-0.5 text-[10px] text-velo-text"
                                >
                                  {it.label}
                                </div>
                              ))}
                              {items.length > 3 && (
                                <div className="text-[10px] text-velo-muted">+{items.length - 3} more</div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-velo-line">
                <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Label</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Period</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Timeline</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {complianceRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-velo-muted">
                        No upcoming obligations in the next ~60 days (or calendar not configured).
                      </td>
                    </tr>
                  ) : (
                    complianceRows.map((r) => (
                      <tr key={r.calendar_id} className="hover:bg-velo-inset/70">
                        <td className="max-w-xs px-3 py-2 font-medium" title={r.label}>
                          {r.label}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-velo-muted">{r.type}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-velo-muted">
                          {r.period_month}/{r.period_year}
                        </td>
                        <td className="px-3 py-2 text-velo-muted">{r.due_date}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                        <td className="px-3 py-2">
                          <DueCell days={r.days_until_due} />
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {tab === 'ap' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <div className="flex items-center justify-end gap-2 border-b border-velo-line bg-velo-panel px-3 py-2">
                <a
                  href={`/api/operations/export?domain=ap`}
                  className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                >
                  Export CSV
                </a>
              </div>
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Vendor</th>
                    <th className="px-3 py-2.5">Invoice #</th>
                    <th className="px-3 py-2.5">Invoice date</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Timeline</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {apRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-velo-muted">
                        No open payables in sheet filter.
                      </td>
                    </tr>
                  ) : (
                    apRows.map((r) => (
                      <tr key={r.invoice_id} className="hover:bg-velo-inset/70">
                        <td className="max-w-[200px] truncate px-3 py-2 font-medium" title={r.vendor_name}>
                          {r.vendor_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoice_number}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.invoice_date}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.due_date}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.total_amount)}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.payment_status}</td>
                        <td className="px-3 py-2">
                          <DueCell days={r.days_until_due} />
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'ar_open' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <div className="flex items-center justify-end gap-2 border-b border-velo-line bg-velo-panel px-3 py-2">
                <a
                  href={`/api/operations/export?domain=ar_open`}
                  className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                >
                  Export CSV
                </a>
              </div>
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Client</th>
                    <th className="px-3 py-2.5">Invoice #</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Follow-ups</th>
                    <th className="px-3 py-2.5">Timeline</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {arOpen.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-velo-muted">
                        No open AR in snapshot.
                      </td>
                    </tr>
                  ) : (
                    arOpen.map((r) => (
                      <tr key={r.invoice_id} className="hover:bg-velo-inset/70">
                        <td className="max-w-[200px] truncate px-3 py-2 font-medium" title={r.client_name}>
                          {r.client_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoice_number}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.due_date}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.total_amount)}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.followup_count}</td>
                        <td className="px-3 py-2">
                          <DueCell days={r.days_until_due} />
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'ar_overdue' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <div className="flex items-center justify-end gap-2 border-b border-velo-line bg-velo-panel px-3 py-2">
                <a
                  href={`/api/operations/export?domain=ar_overdue`}
                  className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                >
                  Export CSV
                </a>
              </div>
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Client</th>
                    <th className="px-3 py-2.5">Invoice #</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {arOd.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-velo-muted">
                        No overdue AR in snapshot.
                      </td>
                    </tr>
                  ) : (
                    arOd.map((r) => (
                      <tr key={r.invoice_id} className="hover:bg-velo-inset/70">
                        <td className="max-w-[200px] truncate px-3 py-2 font-medium" title={r.client_name}>
                          {r.client_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoice_number}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.due_date}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.total_amount)}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'bank' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-velo-line bg-velo-panel px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={bankQuery}
                    onChange={(e) => setBankQuery(e.target.value)}
                    placeholder="Search narration…"
                    className="w-48 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text placeholder-velo-muted/60"
                  />
                  <input
                    value={bankFrom}
                    onChange={(e) => setBankFrom(e.target.value)}
                    placeholder="From YYYY-MM-DD"
                    className="w-32 rounded-md border border-velo-line bg-velo-inset px-2 py-1 font-mono text-xs text-velo-text placeholder-velo-muted/60"
                  />
                  <input
                    value={bankTo}
                    onChange={(e) => setBankTo(e.target.value)}
                    placeholder="To YYYY-MM-DD"
                    className="w-32 rounded-md border border-velo-line bg-velo-inset px-2 py-1 font-mono text-xs text-velo-text placeholder-velo-muted/60"
                  />
                  <select
                    value={bankType}
                    onChange={(e) => setBankType(e.target.value)}
                    className="rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text"
                  >
                    <option value="">type:any</option>
                    <option value="debit">debit</option>
                    <option value="credit">credit</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void loadBankLive(null)}
                    className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBankRowsLive(null);
                      setBankCursor(null);
                    }}
                    className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/operations/export?domain=bank`}
                    className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text hover:bg-velo-inset"
                  >
                    Export CSV
                  </a>
                </div>
              </div>
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Narration</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Mode</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {(bankRowsLive ?? bankRows).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-velo-muted">
                        No bank transactions in workspace.
                        {snapshot.bank_balance_inr != null && (
                          <span className="mt-1 block text-xs">
                            Last balance (INR): {formatInr(String(snapshot.bank_balance_inr))}
                            {snapshot.bank_as_of_date ? ` · as of ${snapshot.bank_as_of_date}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    (bankRowsLive ?? bankRows).map((r) => (
                      <tr key={r.txn_id} className="hover:bg-velo-inset/70">
                        <td className="whitespace-nowrap px-3 py-2 text-velo-muted">{r.date}</td>
                        <td className="max-w-lg px-3 py-2" title={r.narration}>
                          {r.narration}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.amount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatInr(r.balance)}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.type}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.mode}</td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {bankRowsLive && (
                <div className="flex items-center justify-between gap-2 border-t border-velo-line bg-velo-panel px-3 py-2 text-xs text-velo-muted">
                  <span>{bankRowsLive.length} loaded</span>
                  <button
                    type="button"
                    disabled={bankLiveLoading || !bankCursor}
                    onClick={() => void loadBankLive(bankCursor)}
                    className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-xs font-semibold text-velo-text disabled:opacity-50"
                  >
                    {bankLiveLoading ? 'Loading…' : bankCursor ? 'Load more' : 'No more'}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'team' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Email</th>
                    <th className="px-3 py-2.5">Designation</th>
                    <th className="px-3 py-2.5">Department</th>
                    <th className="px-3 py-2.5">DOJ</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {teamRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-velo-muted">
                        No active employees in snapshot.
                      </td>
                    </tr>
                  ) : (
                    teamRows.map((r) => (
                      <tr key={r.employee_id} className="hover:bg-velo-inset/70">
                        <td className="px-3 py-2 font-medium">{r.full_name}</td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-velo-muted" title={r.email}>
                          {r.email}
                        </td>
                        <td className="px-3 py-2 text-velo-muted">{r.designation}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.department}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.doj}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'hires' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {hireRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-velo-muted">
                        No open onboarding / hire tasks in snapshot.
                      </td>
                    </tr>
                  ) : (
                    hireRows.map((r) => (
                      <tr key={r.task_id} className="hover:bg-velo-inset/70">
                        <td className="max-w-md px-3 py-2" title={r.description}>
                          {r.description}
                        </td>
                        <td className="px-3 py-2 text-velo-muted">{r.task_type}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.employee_id}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.due_date}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'hr' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
              <table className="min-w-full divide-y divide-velo-line text-left text-sm">
                <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  <tr>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Due</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-velo-line/80 text-velo-text">
                  {hrRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-velo-muted">
                        No HR blocker tasks in snapshot.
                      </td>
                    </tr>
                  ) : (
                    hrRows.map((r) => (
                      <tr key={r.task_id} className="hover:bg-velo-inset/70">
                        <td className="max-w-md px-3 py-2" title={r.description}>
                          {r.description}
                        </td>
                        <td className="px-3 py-2 text-velo-muted">{r.task_type}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.employee_id}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.due_date}</td>
                        <td className="px-3 py-2 text-velo-muted">{r.status}</td>
                        <td className="px-3 py-2 text-right align-middle">
                          <TriageCta row={{ ...r }} onOpen={openTriage} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-velo-muted">
            APIs:{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">GET /api/operations/snapshot</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/pending-approvals</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">POST /api/workflows/run</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">POST /api/workflows/resume</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">GET /api/workflows/runs</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">POST /api/cron/digest</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">POST /api/cron/escalate-approvals</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/compliance</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/ap-payables</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/ar-open</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/ar-overdue</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/hr-blockers</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/hr-pending-hires</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/bank-recent</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">/employees</code>,{' '}
            <code className="rounded bg-velo-inset-deep px-1 text-velo-text">POST /api/operations/triage</code>.
          </p>
        </>
      )}

      <OperationsTriagePanel
        open={triageOpen}
        onClose={() => {
          setTriageOpen(false);
          setTriageRow(null);
        }}
        domain={tab}
        row={triageRow}
      />
    </div>
  );
}
