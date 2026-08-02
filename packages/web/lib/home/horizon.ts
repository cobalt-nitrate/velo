/**
 * What is next, just beyond the queue (UX-005).
 *
 * "You're all clear" is only reassuring if it is followed by evidence that
 * something is still being watched. An empty panel reads as "the system is
 * broken"; "all clear — next is GST-3B in 12 days" reads as "it is handled".
 *
 * This deliberately looks *past* the 7-day queue horizon: anything inside it
 * would already be in the queue, so by definition the next horizon item is
 * further out than QUEUE_HORIZON_DAYS.
 */
import { prisma } from '@/lib/prisma';
import { parseDate, relativeDay } from './format';

/** compliance_calendar.status values that mean "no longer needs a human". */
const DONE = new Set(['completed', 'done', 'filed']);

export interface HorizonItem {
  label: string;
  dueAt: Date;
  /** Pre-rendered "in 12 days" so the component stays presentational. */
  whenText: string;
}

/**
 * The soonest statutory filing still ahead of us.
 *
 * Returns null when there is genuinely nothing scheduled — the caller should
 * then say so plainly rather than inventing reassurance.
 */
export async function getNextHorizonItem(now: Date = new Date()): Promise<HorizonItem | null> {
  const rows = await prisma.complianceCalendar.findMany({
    orderBy: { dueDate: 'asc' },
    take: 200,
    select: { type: true, label: true, dueDate: true, status: true },
  });

  let best: HorizonItem | null = null;

  for (const row of rows) {
    if (DONE.has(row.status?.trim().toLowerCase() ?? '')) continue;

    const dueAt = parseDate(row.dueDate);
    // Undated rows cannot anchor a "what's next" claim.
    if (!dueAt || Number.isNaN(dueAt.getTime())) continue;
    // Only the future counts; overdue work belongs in the queue, not here.
    if (dueAt.getTime() <= now.getTime()) continue;

    if (best === null || dueAt.getTime() < best.dueAt.getTime()) {
      const what = [row.type?.trim(), row.label?.trim()].filter(Boolean).join(' — ');
      best = {
        label: what || 'statutory filing',
        dueAt,
        whenText: relativeDay(dueAt, now),
      };
    }
  }

  return best;
}
