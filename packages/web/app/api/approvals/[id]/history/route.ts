import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canReview(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if (!canReview(role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const approvalId = params.id;
    const events = await prisma.approvalEvent.findMany({
      where: { approvalId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        actorId: true,
        actorRole: true,
        notes: true,
        payload: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      approval_id: approvalId,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        actor_id: e.actorId,
        actor_role: e.actorRole,
        notes: e.notes,
        payload: e.payload,
        created_at: e.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

