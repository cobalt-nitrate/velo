/** Indian money and date formatting for user-facing strings. */

/** Parse a rupee value out of a text column. Returns null for junk. */
export function parseInr(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (!cleaned) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a date out of a text column.
 *
 * Every date in this schema is stored as TEXT, so bad values are expected.
 * They must degrade to null rather than producing an Invalid Date that
 * silently poisons sorting.
 */
export function parseDate(raw: unknown): Date | null {
  if (!raw || typeof raw !== 'string') return null;

  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t);
}

/** Full precision, Indian grouping: 115640 → "₹1,15,640". */
export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Compact for tiles: 7224376 → "₹72.2L", 11564000 → "₹1.16Cr". */
export function formatInrShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
  return formatInr(amount);
}

/** "26 Jul" — short, no year unless it differs from now. */
export function formatDay(date: Date, now: Date = new Date()): string {
  const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** Midnight UTC on the calendar day a date falls in. */
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Whole calendar days from `from` to `to`, counted in UTC.
 *
 * Counting *days*, not elapsed hours, is the whole point. Rounding the raw
 * millisecond gap gets deadlines wrong by a day: a filing due at UTC midnight
 * tomorrow is only ~11 hours away at 13:00 today, which rounds to zero and
 * renders as "today". In a product where a missed statutory date carries a
 * penalty, that is not a cosmetic bug.
 *
 * UTC matches `formatDay`, which already pins these date-only columns to UTC.
 */
function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / (24 * 60 * 60 * 1000));
}

/**
 * Human elapsed/remaining phrasing: "3 months ago", "in 2 days", "today".
 * Deliberately coarse — precision here reads as clutter.
 */
export function relativeDay(date: Date, now: Date = new Date()): string {
  const days = calendarDaysBetween(now, date);

  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';

  const ago = days < 0;
  const n = Math.abs(days);
  const unit =
    n >= 365
      ? [Math.round(n / 365), 'year']
      : n >= 30
        ? [Math.round(n / 30), 'month']
        : [n, 'day'];

  const [value, noun] = unit as [number, string];
  const plural = value === 1 ? noun : `${noun}s`;
  return ago ? `${value} ${plural} ago` : `in ${value} ${plural}`;
}
