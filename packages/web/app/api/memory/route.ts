import {
  appendDecisionMemory,
  listDecisionMemoryRecent,
} from '@velo/core';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** GET ?limit=50 — recent decision-memory hints (file-backed). */
export async function GET(req: NextRequest) {
  try {
    const limitRaw = req.nextUrl.searchParams.get('limit');
    const limit = limitRaw ? Number(limitRaw) : 50;
    const entries = listDecisionMemoryRecent(
      Number.isFinite(limit) ? limit : 50
    );
    return NextResponse.json({ ok: true, entries, count: entries.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST { tool_id, parameters?, outcome, actor_id?, notes?, signature? }
 * outcome: approved | rejected | auto_executed
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const toolId = String(body.tool_id ?? '').trim();
    if (!toolId) {
      return NextResponse.json(
        { ok: false, error: 'tool_id is required' },
        { status: 400 }
      );
    }
    const outcome = body.outcome;
    if (
      outcome !== 'approved' &&
      outcome !== 'rejected' &&
      outcome !== 'auto_executed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'outcome must be approved, rejected, or auto_executed',
        },
        { status: 400 }
      );
    }
    const parameters =
      body.parameters && typeof body.parameters === 'object'
        ? (body.parameters as Record<string, unknown>)
        : {};
    const entry = appendDecisionMemory({
      tool_id: toolId,
      parameters,
      outcome,
      actor_id:
        typeof body.actor_id === 'string' ? body.actor_id : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      signature:
        typeof body.signature === 'string' ? body.signature : undefined,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
