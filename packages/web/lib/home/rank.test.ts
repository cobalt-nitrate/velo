import { describe, expect, it } from 'vitest';
import { DEFAULT_QUEUE_CAP, bandFor, filterByRole, rankQueue } from './rank';
import type { QueueItem } from './types';

const NOW = new Date('2026-07-26T12:00:00.000Z');

function item(over: Partial<QueueItem> & Pick<QueueItem, 'id'>): QueueItem {
  return {
    source: 'approval',
    href: `/approvals/${over.id}`,
    headline: `Item ${over.id}`,
    consequence: null,
    context: null,
    band: 'this_week',
    dueAt: null,
    amountInr: null,
    roles: ['founder'],
    ...over,
  };
}

const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000);
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000);

describe('bandFor', () => {
  it('puts anything already past into overdue', () => {
    expect(bandFor(hoursFromNow(-1), NOW)).toBe('overdue');
    expect(bandFor(daysFromNow(-120), NOW)).toBe('overdue');
  });

  it('puts the next 48 hours into due_48h', () => {
    expect(bandFor(hoursFromNow(1), NOW)).toBe('due_48h');
    expect(bandFor(hoursFromNow(48), NOW)).toBe('due_48h');
  });

  it('puts the rest of the week into this_week', () => {
    expect(bandFor(hoursFromNow(49), NOW)).toBe('this_week');
    expect(bandFor(daysFromNow(7), NOW)).toBe('this_week');
  });

  it('drops anything beyond the horizon so the queue stays actionable', () => {
    expect(bandFor(daysFromNow(8), NOW)).toBeNull();
    expect(bandFor(daysFromNow(365), NOW)).toBeNull();
  });

  it('keeps undated and unparseable items visible rather than losing them', () => {
    expect(bandFor(null, NOW)).toBe('this_week');
    expect(bandFor(new Date('not a date'), NOW)).toBe('this_week');
  });
});

describe('rankQueue', () => {
  it('orders by band before money', () => {
    const cheapOverdue = item({ id: 'a', band: 'overdue', amountInr: 100 });
    const richLater = item({ id: 'b', band: 'this_week', amountInr: 10_000_000 });

    const { visible } = rankQueue([richLater, cheapOverdue]);
    expect(visible.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('orders by money within a band', () => {
    const small = item({ id: 'small', band: 'overdue', amountInr: 1_000 });
    const large = item({ id: 'large', band: 'overdue', amountInr: 900_000 });

    const { visible } = rankQueue([small, large]);
    expect(visible.map((i) => i.id)).toEqual(['large', 'small']);
  });

  it('sorts items without an amount after items with one', () => {
    const noAmount = item({ id: 'none', band: 'overdue', amountInr: null });
    const withAmount = item({ id: 'some', band: 'overdue', amountInr: 1 });

    const { visible } = rankQueue([noAmount, withAmount]);
    expect(visible.map((i) => i.id)).toEqual(['some', 'none']);
  });

  it('falls back to the earlier due date when amounts tie', () => {
    const later = item({ id: 'later', band: 'overdue', amountInr: 500, dueAt: daysFromNow(-1) });
    const earlier = item({ id: 'earlier', band: 'overdue', amountInr: 500, dueAt: daysFromNow(-9) });

    const { visible } = rankQueue([later, earlier]);
    expect(visible.map((i) => i.id)).toEqual(['earlier', 'later']);
  });

  it('is deterministic when everything else ties', () => {
    const a = item({ id: 'aaa', band: 'overdue' });
    const b = item({ id: 'bbb', band: 'overdue' });

    expect(rankQueue([b, a]).visible.map((i) => i.id)).toEqual(['aaa', 'bbb']);
    expect(rankQueue([a, b]).visible.map((i) => i.id)).toEqual(['aaa', 'bbb']);
  });

  it('caps at three and reports the remainder', () => {
    const items = Array.from({ length: 9 }, (_, n) =>
      item({ id: `i${n}`, band: 'overdue', amountInr: n })
    );

    const { visible, overflowCount } = rankQueue(items);
    expect(visible).toHaveLength(DEFAULT_QUEUE_CAP);
    expect(overflowCount).toBe(6);
  });

  it('reports no overflow when everything fits', () => {
    const { visible, overflowCount } = rankQueue([item({ id: 'only' })]);
    expect(visible).toHaveLength(1);
    expect(overflowCount).toBe(0);
  });

  it('handles an empty queue', () => {
    expect(rankQueue([])).toEqual({ visible: [], overflowCount: 0 });
  });

  it('does not mutate its input', () => {
    const items = [item({ id: 'b', band: 'this_week' }), item({ id: 'a', band: 'overdue' })];
    const order = items.map((i) => i.id);

    rankQueue(items);
    expect(items.map((i) => i.id)).toEqual(order);
  });
});

describe('filterByRole', () => {
  it('hides items an employee should never see', () => {
    const payable = item({ id: 'ap', roles: ['founder', 'finance'] });
    const payslip = item({ id: 'slip', roles: ['employee'] });

    expect(filterByRole([payable, payslip], 'employee').map((i) => i.id)).toEqual(['slip']);
  });

  it('shows everything when the role is unknown', () => {
    const items = [item({ id: 'a' }), item({ id: 'b', roles: ['employee'] })];
    expect(filterByRole(items, null)).toHaveLength(2);
  });
});
