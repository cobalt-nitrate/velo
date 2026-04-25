import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = Number(searchParams.get('year') ?? now.getUTCFullYear());
    const month = Number(searchParams.get('month') ?? now.getUTCMonth() + 1); // 1..12
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ ok: false, error: 'Invalid year/month' }, { status: 400 });
    }

    const start = `${year}-${pad2(month)}-01`;
    const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const end = `${nextMonth.year}-${pad2(nextMonth.month)}-01`;

    const rows = await prisma.complianceCalendar.findMany({
      where: {
        dueDate: { gte: start, lt: end },
      },
      orderBy: { dueDate: 'asc' },
      take: 2000,
      select: {
        calendarId: true,
        type: true,
        label: true,
        periodMonth: true,
        periodYear: true,
        dueDate: true,
        status: true,
        notes: true,
      },
    });

    const byDay: Record<string, Array<Record<string, string>>> = {};
    for (const r of rows) {
      const day = String(r.dueDate ?? '').slice(0, 10);
      if (!day) continue;
      byDay[day] ??= [];
      byDay[day].push({
        calendar_id: r.calendarId,
        type: r.type,
        label: r.label,
        period_month: r.periodMonth,
        period_year: r.periodYear,
        due_date: r.dueDate,
        status: r.status,
        notes: r.notes,
      });
    }

    return NextResponse.json({
      ok: true,
      year,
      month,
      days: byDay,
      count: rows.length,
      computed_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

