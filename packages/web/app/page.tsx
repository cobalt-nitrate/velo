import { ApprovalCard } from '../components/approval-card';
import { AuditTimeline } from '../components/audit-timeline';
import { CommandBar } from '../components/command-bar';
import { EvidenceDrawer } from '../components/evidence-drawer';
import { ExceptionCard } from '../components/exception-card';
import { PolicyCopilot } from '../components/policy-copilot';
import { RunwayTile } from '../components/runway-tile';
import { WeeklyCloseNarrative } from '../components/weekly-close-narrative';

export default function CommandCenterPage() {
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

      <CommandBar />

      <section className="grid gap-4 lg:grid-cols-3">
        <RunwayTile months={7.2} burnRateInr={1460000} confidence={0.88} />
        <ApprovalCard
          title="Approve April payroll run"
          summary="38 employees - INR 12.4L payout - due in 2 days"
          confidence={0.91}
        />
        <ExceptionCard
          title="Vendor bank payee missing"
          reason="Cannot auto-schedule payment until payee is added in banking portal."
          severity="high"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EvidenceDrawer
          title="Evidence drawer"
          items={[
            { label: 'Policy reason', value: 'Payroll actions always require approval.' },
            { label: 'Confidence factors', value: 'Extraction 0.95, Match 0.88, Freshness 0.9' },
            { label: 'Historical context', value: 'Last 3 payroll runs approved with no errors.' },
          ]}
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
            'Runway improved by 0.4 months due to lower vendor outflow.',
            'GST filing checklist is on track, two input documents pending.',
            'AR collection risk increased for one client with 9-day delay.',
          ]}
        />
        <PolicyCopilot />
      </section>
    </main>
  );
}
