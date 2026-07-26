/**
 * Turn the operational snapshot into a flat QueueItem[].
 *
 * One adapter per source. All the text-column parsing lives here so that
 * rank.ts stays pure and the rest of the app never sees a raw enum or a
 * date-shaped string.
 */
import { prisma } from '@/lib/prisma';
import { listPendingApprovals } from '@velo/tools/data';
import { gatherOperationalSnapshot } from '@velo/tools/platform-health';
import { approvalConsequence, approvalPayloadNumber, complianceConsequence } from './consequence';
import { formatInr, parseDate, parseInr, relativeDay } from './format';
import { bandFor } from './rank';
import type { QueueItem, QueueRole } from './types';

/** compliance_calendar.status values that mean "no longer needs a human". */
const COMPLIANCE_DONE = new Set(['completed', 'done', 'filed']);

/** Fallback when an agent left proposed_action_text empty. */
function humaniseActionType(actionType: string): string {
  const words = actionType.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Review this action';
}

/** approver_role is free text; map it onto the roles a queue item addresses. */
function rolesForApprover(approverRole: string): QueueRole[] {
  const r = approverRole.trim().toLowerCase();
  if (r.includes('founder')) return ['founder'];
  if (r.includes('finance')) return ['founder', 'finance'];
  if (r.includes('hr')) return ['founder', 'hr'];
  return ['founder', 'finance'];
}

/**
 * Approvals waiting on a human.
 *
 * Uses listPendingApprovals rather than snapshot.pending_approvals because the
 * snapshot type omits action_payload_json and expires_at — which is where the
 * amount and the reason live.
 */
async function collectApprovals(now: Date): Promise<QueueItem[]> {
  const rows = await listPendingApprovals(25);

  return rows.flatMap((row): QueueItem[] => {
    const id = row.approval_id?.trim();
    if (!id) return [];

    const payload = row.action_payload_json ?? '{}';
    const amountInr = approvalPayloadNumber(payload, 'amount_inr');
    const proposed = row.proposed_action_text?.trim();

    // proposed_action_text is already a human sentence — prefer it over any
    // reconstruction from the enum.
    const headline = proposed || humaniseActionType(row.action_type ?? '');

    // An approval's deadline is when it expires, not when it was created.
    const dueAt = parseDate(row.expires_at);
    const band = bandFor(dueAt, now);
    if (band === null) return [];

    const created = parseDate(row.created_at);

    return [
      {
        id,
        source: 'approval',
        href: `/approvals/${encodeURIComponent(id)}`,
        headline,
        consequence: approvalConsequence(payload),
        context: created ? `Velo asked ${relativeDay(created, now)}` : null,
        band,
        dueAt,
        amountInr,
        roles: rolesForApprover(row.approver_role ?? ''),
      },
    ];
  });
}

/**
 * Statutory filings that are not yet done.
 *
 * Read straight from the table rather than via snapshot.compliance_upcoming:
 * that helper calls get_upcoming_obligations(days_ahead: 60), which is
 * forward-looking, so a filing that is already overdue — the highest-penalty
 * item in the product — never appears in the snapshot at all.
 */
async function collectCompliance(now: Date): Promise<QueueItem[]> {
  const rows = await prisma.complianceCalendar.findMany({
    orderBy: { dueDate: 'asc' },
    take: 200,
    select: { calendarId: true, type: true, label: true, dueDate: true, status: true },
  });

  return rows.flatMap((r): QueueItem[] => {
    const row = {
      calendar_id: r.calendarId,
      type: r.type,
      label: r.label,
      due_date: r.dueDate,
      status: r.status,
    };
    if (COMPLIANCE_DONE.has(row.status?.trim().toLowerCase() ?? '')) return [];

    const dueAt = parseDate(row.due_date);
    const band = bandFor(dueAt, now);
    if (band === null) return [];

    const what = [row.type?.trim(), row.label?.trim()].filter(Boolean).join(' — ');

    return [
      {
        id: row.calendar_id,
        source: 'compliance',
        href: '/operations?tab=compliance',
        headline: `File ${what || 'statutory return'}`,
        consequence: complianceConsequence(row.type ?? ''),
        context: dueAt ? `Due ${relativeDay(dueAt, now)}` : null,
        band,
        dueAt,
        // Filings carry no rupee value of their own; penalty is the stake.
        amountInr: null,
        roles: ['founder', 'finance'],
      },
    ];
  });
}

/** Vendor bills still open. */
function collectPayables(
  rows: { invoice_id: string; vendor_name: string; due_date: string; total_amount: string }[],
  now: Date
): QueueItem[] {
  return rows.flatMap((row): QueueItem[] => {
    const dueAt = parseDate(row.due_date);
    const band = bandFor(dueAt, now);
    if (band === null) return [];

    const amountInr = parseInr(row.total_amount);
    const vendor = row.vendor_name?.trim() || 'vendor';

    return [
      {
        id: row.invoice_id,
        source: 'ap',
        href: '/operations?tab=ap_payables',
        headline: amountInr === null ? `Pay ${vendor}` : `Pay ${vendor} ${formatInr(amountInr)}`,
        consequence: band === 'overdue' ? 'Payment is already past its due date' : null,
        context: dueAt ? `Due ${relativeDay(dueAt, now)}` : null,
        band,
        dueAt,
        amountInr,
        roles: ['founder', 'finance'],
      },
    ];
  });
}

/** Customer invoices past due. */
function collectReceivables(
  rows: {
    invoice_id: string;
    client_name: string;
    due_date: string;
    total_amount: string;
    followup_count: string;
  }[],
  now: Date
): QueueItem[] {
  return rows.flatMap((row): QueueItem[] => {
    const dueAt = parseDate(row.due_date);
    const band = bandFor(dueAt, now);
    if (band === null) return [];

    const amountInr = parseInr(row.total_amount);
    const client = row.client_name?.trim() || 'customer';
    const followups = Number(row.followup_count);

    const context =
      Number.isFinite(followups) && followups > 0
        ? `${followups} follow-up${followups === 1 ? '' : 's'} sent already`
        : dueAt
          ? `Due ${relativeDay(dueAt, now)}`
          : null;

    return [
      {
        id: row.invoice_id,
        source: 'ar',
        href: '/operations?tab=ar_overdue',
        headline:
          amountInr === null ? `Chase ${client}` : `Collect ${formatInr(amountInr)} from ${client}`,
        consequence: band === 'overdue' ? 'Recovery odds fall the longer this runs' : null,
        context,
        band,
        dueAt,
        amountInr,
        roles: ['founder', 'finance'],
      },
    ];
  });
}

/** Blocked people-ops work. */
function collectHrBlockers(
  rows: { task_id: string; task_type: string; description: string; due_date: string }[],
  now: Date
): QueueItem[] {
  return rows.flatMap((row): QueueItem[] => {
    const dueAt = parseDate(row.due_date);
    const band = bandFor(dueAt, now);
    if (band === null) return [];

    const what = row.description?.trim() || humaniseActionType(row.task_type ?? '');

    return [
      {
        id: row.task_id,
        source: 'hr',
        href: '/operations?tab=hires',
        headline: what,
        consequence: null,
        context: dueAt ? `Due ${relativeDay(dueAt, now)}` : 'No due date set',
        band,
        dueAt,
        amountInr: null,
        roles: ['founder', 'hr'],
      },
    ];
  });
}

/**
 * Everything that might need a human, unranked and unfiltered.
 *
 * A failure in any single source must not blank the whole page — each adapter
 * is isolated and contributes nothing on error.
 */
export async function collectQueueItems(now: Date = new Date()): Promise<{
  items: QueueItem[];
  errors: string[];
}> {
  const errors: string[] = [];

  const [approvals, compliance, snapshot] = await Promise.all([
    collectApprovals(now).catch((e: unknown) => {
      errors.push(`approvals: ${e instanceof Error ? e.message : String(e)}`);
      return [] as QueueItem[];
    }),
    collectCompliance(now).catch((e: unknown) => {
      errors.push(`compliance: ${e instanceof Error ? e.message : String(e)}`);
      return [] as QueueItem[];
    }),
    gatherOperationalSnapshot().catch((e: unknown) => {
      errors.push(`snapshot: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }),
  ]);

  const items = [...approvals, ...compliance];

  if (snapshot) {
    items.push(
      ...collectPayables(snapshot.ap_payables_detail ?? [], now),
      ...collectReceivables(snapshot.ar_overdue_detail ?? [], now),
      ...collectHrBlockers(snapshot.hr_blockers_detail ?? [], now)
    );
    if (snapshot.probe_errors?.length) errors.push(...snapshot.probe_errors);
  }

  return { items, errors };
}
