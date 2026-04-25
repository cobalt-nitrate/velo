import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDate(s: string): number {
  const t = new Date(String(s ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function parseAmount(s: string): number {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function monthKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET() {
  try {
    const rows = await prisma.bankTransaction.findMany({
      orderBy: { date: 'asc' },
      take: 5000,
      select: { date: true, amount: true, type: true, balance: true },
    });
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        note: 'No bank transactions available.',
        balance_inr: 0,
        as_of_date: null,
        burn_monthly_inr: 0,
        runway_months: null,
        series: [],
      });
    }

    // Latest balance (prefer last row)
    const last = rows[rows.length - 1];
    const balance = parseAmount(last.balance);
    const asOf = last.date || null;

    // Monthly burn: sum of debits per month (use type if present, else sign heuristic)
    const byMonth = new Map<string, { debit: number; credit: number }>();
    for (const r of rows) {
      const mk = monthKeyFromIso(r.date);
      if (!mk) continue;
      const amt = Math.abs(parseAmount(r.amount));
      const t = String(r.type ?? '').toLowerCase();
      const isDebit = t === 'debit' || t === 'dr';
      const isCredit = t === 'credit' || t === 'cr';
      const cur = byMonth.get(mk) ?? { debit: 0, credit: 0 };
      if (isDebit) cur.debit += amt;
      else if (isCredit) cur.credit += amt;
      else {
        // Fallback: if balance decreases vs prior, treat as debit
        cur.debit += amt;
      }
      byMonth.set(mk, cur);
    }

    const monthsSorted = [...byMonth.keys()].sort();
    const last6 = monthsSorted.slice(-6);
    const burnSamples = last6.map((k) => byMonth.get(k)!.debit).filter((x) => x > 0);
    const burn = burnSamples.length ? burnSamples.reduce((a, b) => a + b, 0) / burnSamples.length : 0;
    const runwayMonths = burn > 0 && balance > 0 ? Math.round((balance / burn) * 10) / 10 : null;

    const series = last6.map((k) => ({
      month: k,
      debit_inr: Math.round(byMonth.get(k)!.debit * 100) / 100,
      credit_inr: Math.round(byMonth.get(k)!.credit * 100) / 100,
    }));

    return NextResponse.json({
      ok: true,
      balance_inr: balance,
      as_of_date: asOf,
      burn_monthly_inr: Math.round(burn * 100) / 100,
      runway_months: runwayMonths,
      series,
      computed_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

