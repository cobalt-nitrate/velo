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
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageRow, setTriageRow] = useState<Record<string, unknown> | null>(null);
  const [approvalModuleFilter, setApprovalModuleFilter] =
    useState<ApprovalModuleFilter>('all');

  const openTriage = useCallback((r: Record<string, unknown>) => {
    setTriageRow(r);
    setTriageOpen(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/snapshot');
      const data = (await res.json()) as {
        ok?: boolean;
        operational_snapshot?: OperationalSnapshot;
        error?: string;
      };
      if (!res.ok || !data.operational_snapshot) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSnapshot(data.operational_snapshot);
      try {
        sessionStorage.setItem(
          OPS_SNAPSHOT_STORAGE_KEY,
          JSON.stringify({ snapshot: data.operational_snapshot }),
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
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sheets are not configured in this environment — snapshot is empty. Set Google service
          account and <code className="rounded bg-velo-inset-deep px-1 text-velo-text">SHEETS_*_ID</code> in{' '}
          <code className="rounded bg-velo-inset-deep px-1 text-velo-text">.env.local</code>.
        </div>
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
          )}

          {tab === 'ap' && (
            <div className="overflow-x-auto rounded-xl border border-velo-line">
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
                  {bankRows.length === 0 ? (
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
                    bankRows.map((r) => (
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
