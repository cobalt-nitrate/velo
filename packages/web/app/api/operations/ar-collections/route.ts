import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseAmount(s: string): number {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(s: string): Date | null {
  const d = new Date(String(s ?? ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  const aa = new Date(a);
  const bb = new Date(b);
  aa.setUTCHours(0, 0, 0, 0);
  bb.setUTCHours(0, 0, 0, 0);
  return Math.round((bb.getTime() - aa.getTime()) / 86400000);
}

export async function GET() {
  try {
    const open = await prisma.arInvoice.findMany({
      where: { NOT: { status: { in: ['paid', 'PAID', 'Paid', 'cancelled', 'CANCELLED'] } } },
      select: { invoiceId: true, clientName: true, invoiceNumber: true, dueDate: true, totalAmount: true, status: true },
      take: 5000,
    });

    const outstanding = open.reduce((sum, r) => sum + parseAmount(r.totalAmount), 0);

    // Avg days to collect: computed from paid invoices with both invoice_date and payment_received_date
    const paid = await prisma.arInvoice.findMany({
      where: { status: { in: ['paid', 'PAID', 'Paid'] } },
      orderBy: { invoiceDate: 'desc' },
      take: 300,
      select: { invoiceDate: true, paymentReceivedDate: true },
    });
    const samples = paid
      .map((r) => {
        const a = parseDate(r.invoiceDate);
        const b = parseDate(r.paymentReceivedDate);
        if (!a || !b) return null;
        const d = daysBetween(a, b);
        return d >= 0 && d <= 365 ? d : null;
      })
      .filter((x): x is number => typeof x === 'number');
    const avgDays = samples.length ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10 : null;

    const today = new Date();
    const overdue = open
      .map((r) => {
        const due = parseDate(r.dueDate);
        if (!due) return null;
        const od = daysBetween(due, today); // positive => overdue
        return { ...r, overdue_days: od > 0 ? od : 0 };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.overdue_days - a.overdue_days)
      .slice(0, 5)
      .map((r) => ({
        invoice_id: r.invoiceId,
        client_name: r.clientName,
        invoice_number: r.invoiceNumber,
        due_date: r.dueDate,
        total_amount: r.totalAmount,
        status: r.status,
        overdue_days: r.overdue_days,
      }));

    return NextResponse.json({
      ok: true,
      total_outstanding_inr: Math.round(outstanding * 100) / 100,
      avg_days_to_collect: avgDays,
      top_overdue: overdue,
      computed_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

