/**
 * Runway from the bank ledger.
 *
 * Extracted from app/api/operations/runway/route.ts so the home page and the
 * API compute the same number. Previously the page hardcoded a burn of
 * ₹12,50,000 while the API computed the real figure — the tile was showing an
 * invented runway.
 */
import { prisma } from '@/lib/prisma';

export interface RunwaySeriesPoint {
  month: string;
  debit_inr: number;
  credit_inr: number;
}

export interface Runway {
  balance_inr: number;
  as_of_date: string | null;
  burn_monthly_inr: number;
  /** Null when there is not enough data to say honestly. */
  runway_months: number | null;
  series: RunwaySeriesPoint[];
  note?: string;
}

const EMPTY: Runway = {
  balance_inr: 0,
  as_of_date: null,
  burn_monthly_inr: 0,
  runway_months: null,
  series: [],
  note: 'No bank transactions available.',
};

function parseAmount(s: unknown): number {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function monthKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getRunway(): Promise<Runway> {
  const rows = await prisma.bankTransaction.findMany({
    orderBy: { date: 'asc' },
    take: 5000,
    select: { date: true, amount: true, type: true, balance: true },
  });

  if (rows.length === 0) return EMPTY;

  const last = rows[rows.length - 1];
  const balance = parseAmount(last.balance);

  const byMonth = new Map<string, { debit: number; credit: number }>();
  for (const r of rows) {
    const mk = monthKeyFromIso(r.date);
    if (!mk) continue;

    const amt = Math.abs(parseAmount(r.amount));
    const t = String(r.type ?? '').toLowerCase();
    const cur = byMonth.get(mk) ?? { debit: 0, credit: 0 };

    if (t === 'credit' || t === 'cr') cur.credit += amt;
    else cur.debit += amt; // debit, or unknown type — treat as spend

    byMonth.set(mk, cur);
  }

  const last6 = [...byMonth.keys()].sort().slice(-6);
  const burnSamples = last6.map((k) => byMonth.get(k)!.debit).filter((x) => x > 0);
  const burn = burnSamples.length
    ? burnSamples.reduce((a, b) => a + b, 0) / burnSamples.length
    : 0;

  return {
    balance_inr: balance,
    as_of_date: last.date || null,
    burn_monthly_inr: Math.round(burn * 100) / 100,
    runway_months: burn > 0 && balance > 0 ? Math.round((balance / burn) * 10) / 10 : null,
    series: last6.map((k) => ({
      month: k,
      debit_inr: Math.round(byMonth.get(k)!.debit * 100) / 100,
      credit_inr: Math.round(byMonth.get(k)!.credit * 100) / 100,
    })),
  };
}
