import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseAmount(s: string): number {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function daysOverdue(due: string): number | null {
  const t = new Date(String(due ?? '').slice(0, 10)).getTime();
  if (Number.isNaN(t)) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dueD = new Date(t);
  dueD.setUTCHours(0, 0, 0, 0);
  const delta = Math.round((today.getTime() - dueD.getTime()) / 86400000);
  return delta <= 0 ? 0 : delta;
}

export async function GET() {
  try {
    const rows = await prisma.apInvoice.findMany({
      where: {
        NOT: { paymentStatus: { in: ['paid', 'PAID', 'Paid', 'cleared', 'CLEARED'] } },
      },
      select: { invoiceId: true, vendorName: true, totalAmount: true, dueDate: true, paymentStatus: true },
      take: 5000,
    });

    const buckets = {
      '0_30': { count: 0, total_inr: 0 },
      '31_60': { count: 0, total_inr: 0 },
      '60_plus': { count: 0, total_inr: 0 },
      unknown: { count: 0, total_inr: 0 },
    };

    for (const r of rows) {
      const amt = parseAmount(r.totalAmount);
      const d = daysOverdue(r.dueDate);
      if (d == null) {
        buckets.unknown.count += 1;
        buckets.unknown.total_inr += amt;
      } else if (d <= 30) {
        buckets['0_30'].count += 1;
        buckets['0_30'].total_inr += amt;
      } else if (d <= 60) {
        buckets['31_60'].count += 1;
        buckets['31_60'].total_inr += amt;
      } else {
        buckets['60_plus'].count += 1;
        buckets['60_plus'].total_inr += amt;
      }
    }

    return NextResponse.json({
      ok: true,
      buckets: {
        '0-30': buckets['0_30'],
        '31-60': buckets['31_60'],
        '60+': buckets['60_plus'],
        unknown: buckets.unknown,
      },
      computed_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

