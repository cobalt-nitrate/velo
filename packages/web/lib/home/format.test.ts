import { describe, expect, it } from 'vitest';
import { formatInr, formatInrShort, parseDate, parseInr, relativeDay } from './format';

describe('relativeDay', () => {
  // The regression this suite exists for: counting elapsed hours instead of
  // calendar days made a filing due at UTC midnight tomorrow read as "today"
  // whenever it was checked after ~noon.
  const afternoon = new Date('2026-08-02T13:11:00.000Z');

  it('calls a date-only due date tomorrow, not today', () => {
    expect(relativeDay(new Date('2026-08-03'), afternoon)).toBe('tomorrow');
  });

  it('still says today for something later the same day', () => {
    expect(relativeDay(new Date('2026-08-02T23:30:00.000Z'), afternoon)).toBe('today');
  });

  it('does not collapse two days into one', () => {
    expect(relativeDay(new Date('2026-08-04'), afternoon)).toBe('in 2 days');
  });

  it('handles yesterday from an early-morning now', () => {
    const morning = new Date('2026-08-02T01:00:00.000Z');
    expect(relativeDay(new Date('2026-08-01'), morning)).toBe('yesterday');
  });

  it('is symmetric across midnight boundaries', () => {
    const lateNight = new Date('2026-08-02T23:59:00.000Z');
    expect(relativeDay(new Date('2026-08-03'), lateNight)).toBe('tomorrow');
    expect(relativeDay(new Date('2026-08-02'), lateNight)).toBe('today');
  });

  it('coarsens to months and years', () => {
    expect(relativeDay(new Date('2026-05-02'), afternoon)).toBe('3 months ago');
    expect(relativeDay(new Date('2026-10-01'), afternoon)).toBe('in 2 months');
    expect(relativeDay(new Date('2025-08-02'), afternoon)).toBe('1 year ago');
  });
});

describe('parseInr', () => {
  it('strips rupee formatting', () => {
    expect(parseInr('₹1,15,640')).toBe(115640);
    expect(parseInr('  4800 ')).toBe(4800);
    expect(parseInr(1234)).toBe(1234);
  });

  it('returns null for junk rather than NaN', () => {
    expect(parseInr('')).toBeNull();
    expect(parseInr('n/a')).toBeNull();
    expect(parseInr(null)).toBeNull();
    expect(parseInr(undefined)).toBeNull();
  });
});

describe('parseDate', () => {
  it('degrades bad text to null instead of Invalid Date', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it('parses the formats the text columns actually hold', () => {
    expect(parseDate('2026-08-03')?.toISOString()).toBe('2026-08-03T00:00:00.000Z');
    expect(parseDate('2026-04-01T05:00:00.000Z')?.toISOString()).toBe('2026-04-01T05:00:00.000Z');
  });
});

describe('money formatting', () => {
  it('groups in the Indian system', () => {
    expect(formatInr(115640)).toBe('₹1,15,640');
  });

  it('compacts to lakh and crore', () => {
    expect(formatInrShort(7224376)).toBe('₹72.2L');
    expect(formatInrShort(11564000)).toBe('₹1.16Cr');
    expect(formatInrShort(4800)).toBe('₹4,800');
  });
});
