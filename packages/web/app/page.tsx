import Link from 'next/link';
import { executeSheetTool, listPendingApprovals } from '@velo/tools/sheets';
import { ApprovalCard } from '../components/approval-card';
import { AuditTimeline } from '../components/audit-timeline';
import { EvidenceDrawer } from '../components/evidence-drawer';
import { ExceptionCard } from '../components/exception-card';
import { PolicyCopilot } from '../components/policy-copilot';
import { RunwayTile } from '../components/runway-tile';
import { WeeklyCloseNarrative } from '../components/weekly-close-narrative';

export default async function CommandCenterPage() {
  const pending = await listPendingApprovals(5);
  const top = pending[0];

  let months = 6;
  let burn = 1250000;
  let cashConf = 0.75;
  try {
    const bal = await executeSheetTool({
      tool_id: 'sheets.bank_transactions.get_latest_balance',
      company_id: 'demo-company',
    });
    const b = bal as { balance_inr?: number; transaction_count?: number };
    if (typeof b.balance_inr === 'number' && b.balance_inr > 0 && b.transaction_count) {
      months = Math.min(24, Math.max(0.5, b.balance_inr / (burn * 1.1)));
      cashConf = b.transaction_count >= 3 ? 0.88 : 0.72;
    }
  } catch {
    /* optional runway enrichment */
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Velo Command Center</h1>
          <p className="text-sm text-velo-muted">
            Evidence-first approvals and autonomous operations.
          </p>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-velo-line bg-velo-panel/60 px-4 py-3 text-sm">
        <span className="text-velo-muted">Workspace</span>
        <Link
          href="/chat"
          className="rounded-md bg-velo-accent px-3 py-1.5 font-medium text-black hover:opacity-90"
        >
          Open chat
        </Link>
        <Link href="/uploads" className="text-velo-accent hover:underline">
          Upload files
        </Link>
        <Link href="/files" className="text-velo-accent hover:underline">
          Browse files
        </Link>
        <Link href="/settings" className="text-velo-accent hover:underline">
          Configuration
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <RunwayTile months={months} burnRateInr={burn} confidence={cashConf} />
        <ApprovalCard
          title={
            top?.action_type
              ? top.action_type
              : 'No pending approvals'
          }
          summary={
            top?.proposed_action_text ??
            'Agent-generated approvals appear here after a gated tool call.'
          }
          confidence={top?.confidence_score ? Number(top.confidence_score) : 0}
          approvalId={top?.approval_id}
        />
        <ExceptionCard
          title="Vendor bank payee missing"
          reason="Cannot auto-schedule payment until payee is added in banking portal."
          severity="high"
        />
      </section>

      {pending.length > 1 && (
        <section className="rounded-xl border border-velo-line bg-velo-panel/50 p-3 text-xs text-velo-muted">
          <p className="font-medium text-velo-text">Queue ({pending.length})</p>
          <ul className="mt-2 space-y-1">
            {pending.slice(1).map((row) => (
              <li key={row.approval_id}>
                <a
                  href={`/approvals/${encodeURIComponent(row.approval_id)}`}
                  className="text-velo-accent hover:underline"
                >
                  {row.approval_id}
                </a>{' '}
                — {row.action_type}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <EvidenceDrawer
          title="Evidence drawer"
          items={
            top
              ? [
                  {
                    label: 'Approval id',
                    value: top.approval_id,
                  },
                  {
                    label: 'Agent',
                    value: top.agent_id,
                  },
                  {
                    label: 'Confidence',
                    value: top.confidence_score,
                  },
                ]
              : [
                  { label: 'Policy reason', value: 'High-impact actions require explicit review.' },
                  {
                    label: 'Data source',
                    value: 'approval_requests sheet or in-memory store.',
                  },
                ]
          }
        />
        <AuditTimeline
          events={[
            { id: '1', event: 'PAYROLL_RUN_REQUESTED', timestamp: '2026-04-03T09:00:00.000Z' },
            { id: '2', event: 'POLICY_DECISION_REQUEST_APPROVAL', timestamp: '2026-04-03T09:00:02.000Z' },
            { id: '3', event: 'APPROVAL_REQUESTED', timestamp: '2026-04-03T09:00:03.000Z' },
          ]}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <WeeklyCloseNarrative
          highlights={[
            'Runway tile uses imported bank_transactions when available.',
            'GST filing checklist follows compliance_calendar in Sheets.',
            'Use Chat with the orchestrator agent for cross-domain routing.',
          ]}
        />
        <PolicyCopilot />
      </section>
    </main>
  );
}
