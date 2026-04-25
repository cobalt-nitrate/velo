import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canReview(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

function isPending(status: string): boolean {
  return String(status ?? '').trim().toUpperCase() === 'PENDING' || String(status ?? '').trim() === '';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    const actor = session?.user?.email ?? '';
    if (!actor) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if (!canReview(role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as {
      approval_ids?: unknown;
      min_confidence?: unknown;
      notes?: unknown;
      idempotency_key?: unknown;
    };

    const ids = Array.isArray(body.approval_ids)
      ? body.approval_ids.map((x) => String(x).trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'approval_ids must be a non-empty array' }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json({ ok: false, error: 'Max 50 approvals per bulk request' }, { status: 400 });
    }

    const min = clamp01(Number(body.min_confidence ?? 0.9));
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : 'bulk_approve';
    const idem = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim().slice(0, 64) : '';

    // Simple idempotency: if a bulk event already exists with this key, treat as success
    if (idem) {
      const existing = await prisma.approvalEvent.findFirst({
        where: { type: 'BULK_APPROVE', payload: { path: ['idempotency_key'], equals: idem } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ ok: true, idempotent: true });
      }
    }

    const now = new Date().toISOString();
    const approvals = await prisma.approvalRequest.findMany({
      where: { approvalId: { in: ids } },
      select: { approvalId: true, status: true, confidenceScore: true },
    });

    const byId = new Map(approvals.map((a) => [a.approvalId, a]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) {
      return NextResponse.json({ ok: false, error: `Approvals not found: ${missing.slice(0, 10).join(', ')}` }, { status: 404 });
    }

    const eligible = approvals.filter((a) => {
      const conf = Number(String(a.confidenceScore ?? '').trim());
      const okConf = Number.isFinite(conf) ? conf >= min : false;
      return isPending(a.status) && okConf;
    });

    const ineligible = approvals
      .filter((a) => !eligible.includes(a))
      .map((a) => a.approvalId);

    if (eligible.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No eligible approvals (must be PENDING and above min_confidence).',
        ineligible,
      }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      for (const a of eligible) {
        await tx.approvalRequest.update({
          where: { approvalId: a.approvalId },
          data: {
            status: 'APPROVED',
            resolvedBy: actor,
            resolvedAt: now,
            resolutionNotes: notes,
          },
        });
        await tx.approvalEvent.create({
          data: {
            approvalId: a.approvalId,
            type: 'APPROVED',
            actorId: actor,
            actorRole: role ?? '',
            notes,
            payload: { bulk: true, min_confidence: min, idempotency_key: idem || undefined },
          },
        });
      }

      await tx.approvalEvent.create({
        data: {
          approvalId: eligible[0].approvalId,
          type: 'BULK_APPROVE',
          actorId: actor,
          actorRole: role ?? '',
          notes: `bulk_count=${eligible.length}`,
          payload: { idempotency_key: idem || undefined, approvals: eligible.map((x) => x.approvalId) },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      approved: eligible.map((a) => a.approvalId),
      skipped: ineligible,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

