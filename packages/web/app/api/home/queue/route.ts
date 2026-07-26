import { collectQueueItems } from '@/lib/home/collect';
import { DEFAULT_QUEUE_CAP, rankQueue } from '@/lib/home/rank';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What needs a human right now, ranked and capped. */
export async function GET(req: Request) {
  try {
    const now = new Date();
    const capParam = Number(new URL(req.url).searchParams.get('cap'));
    const cap = Number.isFinite(capParam) && capParam > 0 ? capParam : DEFAULT_QUEUE_CAP;

    const { items, errors } = await collectQueueItems(now);
    const { visible, overflowCount } = rankQueue(items, cap);

    return NextResponse.json({
      ok: true,
      items: visible,
      overflowCount,
      allClear: items.length === 0,
      errors: errors.length ? errors : undefined,
      generated_at: now.toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
