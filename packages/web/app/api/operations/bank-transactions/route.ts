import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function parseAmount(s: string): number {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') ?? '').trim();
    const from = (searchParams.get('from') ?? '').trim(); // YYYY-MM-DD
    const to = (searchParams.get('to') ?? '').trim(); // YYYY-MM-DD
    const min = (searchParams.get('min') ?? '').trim();
    const max = (searchParams.get('max') ?? '').trim();
    const type = (searchParams.get('type') ?? '').trim().toLowerCase(); // debit|credit
    const limit = clamp(Number(searchParams.get('limit') ?? 50), 1, 200);
    const cursor = (searchParams.get('cursor') ?? '').trim();

    const where: any = {};
    if (query) where.narration = { contains: query, mode: 'insensitive' };
    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    if (type) where.type = { in: [type, type.toUpperCase()] };

    const minN = min ? parseAmount(min) : null;
    const maxN = max ? parseAmount(max) : null;

    let rows = await prisma.bankTransaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { txnId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { txnId: cursor }, skip: 1 } : {}),
      select: { txnId: true, date: true, narration: true, amount: true, balance: true, type: true, mode: true },
    });

    // Amount filtering (strings in schema; do in-memory after limiting)
    if (minN != null || maxN != null) {
      rows = rows.filter((r) => {
        const a = Math.abs(parseAmount(r.amount));
        if (minN != null && a < minN) return false;
        if (maxN != null && a > maxN) return false;
        return true;
      });
    }

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nextCursor = hasMore ? page[page.length - 1]?.txnId ?? null : null;

    return NextResponse.json({
      ok: true,
      rows: page.map((r) => ({
        txn_id: r.txnId,
        date: r.date,
        narration: r.narration,
        amount: r.amount,
        balance: r.balance,
        type: r.type,
        mode: r.mode,
      })),
      next_cursor: nextCursor,
      computed_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

