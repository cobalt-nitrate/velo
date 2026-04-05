import { gatherOperationalSnapshot } from '@velo/tools/platform-health';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live operational snapshot (same shape as healthcheck.operational_snapshot). */
export async function GET() {
  try {
    const operational_snapshot = await gatherOperationalSnapshot();
    return NextResponse.json({ ok: true, operational_snapshot, generated_at: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
