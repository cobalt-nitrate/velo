import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function founderOnly(session: Session | null): Response | null {
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
  }
  if ((session.user as { actor_role?: string }).actor_role !== 'founder') {
    return NextResponse.json({ ok: false, error: 'Forbidden — founder role required' }, { status: 403 });
  }
  return null;
}

/**
 * GET — list active sessions (founder only).
 * Query params:
 * - email?: string (filter to a specific user)
 * - include_revoked?: "1" | "0" (default "0")
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const { searchParams } = new URL(req.url);
    const email = (searchParams.get('email') ?? '').trim().toLowerCase();
    const includeRevoked = (searchParams.get('include_revoked') ?? '0') === '1';

    const user = email
      ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
      : null;

    if (email && !user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const rows = await prisma.userSession.findMany({
      where: {
        ...(user ? { userId: user.id } : {}),
        ...(includeRevoked ? {} : { revokedAt: null }),
      },
      orderBy: { lastSeen: 'desc' },
      take: 250,
      select: {
        sessionId: true,
        createdAt: true,
        lastSeen: true,
        revokedAt: true,
        revokedBy: true,
        ip: true,
        userAgent: true,
        user: { select: { email: true, name: true, role: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      sessions: rows.map((r) => ({
        sessionId: r.sessionId,
        createdAt: r.createdAt.toISOString(),
        lastSeen: r.lastSeen.toISOString(),
        revokedAt: r.revokedAt?.toISOString() ?? null,
        revokedBy: r.revokedBy ?? null,
        ip: r.ip ?? null,
        userAgent: r.userAgent ?? null,
        user: r.user,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH — revoke a specific sessionId (founder only).
 * Body: { sessionId: string }
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const body = (await req.json()) as { sessionId?: unknown };
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: 'sessionId is required' }, { status: 400 });
    }

    const updated = await prisma.userSession.update({
      where: { sessionId },
      data: {
        revokedAt: new Date(),
        revokedBy: session!.user!.email!,
      },
      select: { sessionId: true },
    });

    return NextResponse.json({ ok: true, sessionId: updated.sessionId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('Record to update not found') ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

