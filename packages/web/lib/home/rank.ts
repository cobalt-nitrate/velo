/**
 * Queue ranking — pure, no I/O, no dates from the ambient clock.
 *
 * The rule, in one sentence: overdue first, then due within 48 hours, then the
 * rest of the week; within a band the largest rupee amount wins.
 *
 * This is a product decision, not an engineering one. Keeping it here (pure and
 * tested) means changing your mind is a one-file edit.
 */
import type { QueueBand, QueueItem, QueueRole, RankedQueue } from './types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Items further out than this are horizon, not queue. */
export const QUEUE_HORIZON_DAYS = 7;

/** Default number of items shown before collapsing into "N more". */
export const DEFAULT_QUEUE_CAP = 3;

const BAND_ORDER: Record<QueueBand, number> = {
  overdue: 0,
  due_48h: 1,
  this_week: 2,
};

/**
 * Band for a due date relative to `now`.
 *
 * Returns null when the item is beyond the horizon — the caller should drop it
 * from the queue rather than showing something that is not yet actionable.
 *
 * A null `dueAt` means the source has no usable date (bad text column, or a task
 * with no deadline). Those are still real work, so they land in `this_week`
 * where they sort last rather than disappearing.
 */
export function bandFor(dueAt: Date | null, now: Date): QueueBand | null {
  if (dueAt === null || Number.isNaN(dueAt.getTime())) return 'this_week';

  const delta = dueAt.getTime() - now.getTime();
  if (delta < 0) return 'overdue';
  if (delta <= 2 * DAY_MS) return 'due_48h';
  if (delta <= QUEUE_HORIZON_DAYS * DAY_MS) return 'this_week';
  return null;
}

/** Descending by amount; items without an amount sort after those with one. */
function byAmountDesc(a: QueueItem, b: QueueItem): number {
  if (a.amountInr === b.amountInr) return 0;
  if (a.amountInr === null) return 1;
  if (b.amountInr === null) return -1;
  return b.amountInr - a.amountInr;
}

/** Ascending by due date; undated sorts after dated. */
function byDueAsc(a: QueueItem, b: QueueItem): number {
  const at = a.dueAt?.getTime() ?? null;
  const bt = b.dueAt?.getTime() ?? null;
  if (at === bt) return 0;
  if (at === null) return 1;
  if (bt === null) return -1;
  return at - bt;
}

/**
 * Order and cap the queue.
 *
 * Sort is total and deterministic — band, then amount, then due date, then id —
 * so the same input always renders in the same order.
 */
export function rankQueue(items: QueueItem[], cap: number = DEFAULT_QUEUE_CAP): RankedQueue {
  const ordered = [...items].sort(
    (a, b) =>
      BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
      byAmountDesc(a, b) ||
      byDueAsc(a, b) ||
      a.id.localeCompare(b.id)
  );

  const limit = Math.max(0, cap);
  return {
    visible: ordered.slice(0, limit),
    overflowCount: Math.max(0, ordered.length - limit),
  };
}

/** Keep only items addressed to this role. An unknown role sees everything. */
export function filterByRole(items: QueueItem[], role: QueueRole | null): QueueItem[] {
  if (!role) return items;
  return items.filter((i) => i.roles.includes(role));
}
