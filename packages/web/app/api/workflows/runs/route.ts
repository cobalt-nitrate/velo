import { readWorkflowRunsSnapshot } from '@velo/core/workflow';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET ?status=WAITING_FOR_APPROVAL — inspect persisted workflow runs (disk-backed). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status')?.trim();
    const snap = readWorkflowRunsSnapshot();
    let runs = Object.entries(snap).map(([run_id, state]) => ({
      ...state,
      run_id,
    }));
    if (statusFilter) {
      const u = statusFilter.toUpperCase();
      runs = runs.filter((r) => String(r.status).toUpperCase() === u);
    }
    runs.sort(
      (a, b) =>
        String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))
    );
    return NextResponse.json({ ok: true, count: runs.length, runs });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
