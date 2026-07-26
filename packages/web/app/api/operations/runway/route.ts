import { getRunway } from '@/lib/home/runway';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cash, burn and runway from the bank ledger. */
export async function GET() {
  try {
    const runway = await getRunway();
    return NextResponse.json({ ok: true, ...runway, computed_at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
