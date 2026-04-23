import { listPendingApprovals } from '@velo/tools/data';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Pending Velo approval queue (same source as healthcheck pending_approvals). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)));
    const rows = await listPendingApprovals(limit);
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
