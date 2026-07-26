/**
 * Home queue — "what needs you today".
 *
 * Every source (approvals, compliance, AP, AR, HR) normalises to QueueItem so
 * ranking stays a single pure function. See collect.ts for the adapters.
 */

/** Who a queue item is addressed to. Mirrors the roles used by approver_role. */
export type QueueRole = 'founder' | 'finance' | 'hr' | 'employee';

/**
 * Urgency band. Ordering is band-first, money-second — deliberately simple so
 * the order can be explained to a user in one sentence.
 */
export type QueueBand = 'overdue' | 'due_48h' | 'this_week';

export type QueueSource = 'approval' | 'compliance' | 'ap' | 'ar' | 'hr';

export interface QueueItem {
  /** approval_id | calendar_id | invoice_id | task_id — stable per source. */
  id: string;
  source: QueueSource;
  href: string;
  /** Human sentence. Never a raw enum: "Pay Zoom ₹1,15,640". */
  headline: string;
  /** What happens if ignored. Null when we cannot say honestly. */
  consequence: string | null;
  /** Supporting detail: "4 follow-ups, nothing since 10 Apr". */
  context: string | null;
  band: QueueBand;
  /** Null when the source has no usable date — such items sort last. */
  dueAt: Date | null;
  /** Tiebreak within a band. Null sorts after any amount. */
  amountInr: number | null;
  roles: QueueRole[];
}

export interface RankedQueue {
  /** Capped, ordered items to show. */
  visible: QueueItem[];
  /** How many real items were suppressed behind "N more". */
  overflowCount: number;
}
