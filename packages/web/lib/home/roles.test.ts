import { describe, expect, it } from 'vitest';
import { filterByRole } from './rank';
import { seesEverything, toQueueRole } from './roles';
import type { QueueItem } from './types';

function item(id: string, roles: QueueItem['roles']): QueueItem {
  return {
    id,
    source: 'ap',
    href: '/x',
    headline: id,
    consequence: null,
    context: null,
    band: 'this_week',
    dueAt: null,
    amountInr: null,
    roles,
  };
}

describe('toQueueRole', () => {
  it('maps the roles the database actually stores', () => {
    expect(toQueueRole('founder')).toBe('founder');
    expect(toQueueRole('finance')).toBe('finance');
    expect(toQueueRole('employee')).toBe('employee');
  });

  it('maps the spellings the code uses instead', () => {
    expect(toQueueRole('finance_lead')).toBe('finance');
    expect(toQueueRole('hr_lead')).toBe('hr');
    expect(toQueueRole('hr')).toBe('hr');
  });

  it('treats a manager as an employee, not a founder', () => {
    expect(toQueueRole('manager')).toBe('employee');
  });

  it('is case and whitespace insensitive', () => {
    expect(toQueueRole('  Finance_Lead ')).toBe('finance');
    expect(toQueueRole('FOUNDER')).toBe('founder');
    expect(toQueueRole('hr lead')).toBe('hr');
  });

  // The important one: an unmapped role must not see everything.
  it('falls back to the least privileged role, never the most', () => {
    expect(toQueueRole('wizard')).toBe('employee');
    expect(toQueueRole('')).toBe('employee');
    expect(toQueueRole(null)).toBe('employee');
    expect(toQueueRole(undefined)).toBe('employee');
  });
});

describe('seesEverything', () => {
  it('is true only for a founder', () => {
    expect(seesEverything('founder')).toBe(true);
    expect(seesEverything('finance')).toBe(false);
    expect(seesEverything('hr')).toBe(false);
    expect(seesEverything('employee')).toBe(false);
  });
});

describe('role scoping end to end', () => {
  const items = [
    item('ap-1', ['founder', 'finance']),
    item('hr-1', ['founder', 'hr']),
  ];

  it('gives finance the money work and not the people work', () => {
    expect(filterByRole(items, 'finance').map((i) => i.id)).toEqual(['ap-1']);
  });

  it('gives hr the people work and not the money work', () => {
    expect(filterByRole(items, 'hr').map((i) => i.id)).toEqual(['hr-1']);
  });

  // UX-003: "an employee sees payslips and leave, never AP aging".
  it('shows an employee nothing they are not addressed on', () => {
    expect(filterByRole(items, 'employee')).toEqual([]);
  });
});
