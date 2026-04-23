import { authOptions } from '@/lib/auth';
import { consumeInvite, deleteInvite, getInvite } from '@/lib/invites-store';
import { prisma } from '@/lib/prisma';
import { createUser } from '@/lib/users-registry';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Ctx = { params: { token: string } };

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
 * GET — validate an invite token (public).
 * Returns safe subset: role, email scope, note, expiry.
 * Always returns the same error for not_found / expired / consumed
 * to avoid leaking invite state to unauthenticated callers.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const invite = await getInvite(params.token);

    if (!invite) {
      return NextResponse.json({ ok: false, error: 'Invite not found or has expired.' }, { status: 404 });
    }
    if (invite.consumedAt) {
      return NextResponse.json({ ok: false, error: 'This invite has already been used.' }, { status: 410 });
    }
    if (invite.expiresAt < new Date().toISOString()) {
      return NextResponse.json(
        { ok: false, error: 'This invite has expired. Ask a founder to send a new one.' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      ok: true,
      invite: {
        role: invite.role,
        email: invite.email,
        note: invite.note,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * POST — accept an invite by creating a new account.
 * Body: { email?: string; name?: string; password: string }
 *
 * If the invite is email-scoped, body.email must match invite.email.
 * The user must not already have an account.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      name?: unknown;
      password?: unknown;
    };

    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() || null : null;
    const bodyEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    // Validate password before touching the DB
    if (password.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 10 characters.' },
        { status: 400 }
      );
    }

    // Validate invite
    const invite = await getInvite(params.token);
    if (!invite) {
      return NextResponse.json({ ok: false, error: 'Invite not found or has expired.' }, { status: 404 });
    }
    if (invite.consumedAt) {
      return NextResponse.json({ ok: false, error: 'This invite has already been used.' }, { status: 410 });
    }
    if (invite.expiresAt < new Date().toISOString()) {
      return NextResponse.json({ ok: false, error: 'This invite has expired.' }, { status: 410 });
    }

    // Resolve email: locked to invite.email if scoped, otherwise from body
    const email = invite.email ?? bodyEmail;
    if (!email || !/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'A valid email address is required.' }, { status: 400 });
    }
    if (invite.email && bodyEmail && bodyEmail !== invite.email) {
      return NextResponse.json(
        { ok: false, error: `This invite is restricted to ${invite.email}.` },
        { status: 403 }
      );
    }

    // No existing account allowed
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'An account with this email already exists. Sign in instead.' },
        { status: 409 }
      );
    }

    // Consume the invite atomically before creating the account
    const consumed = await consumeInvite(params.token, email);
    if (!consumed) {
      return NextResponse.json(
        { ok: false, error: 'Invite was just used or expired. Request a new one.' },
        { status: 409 }
      );
    }

    // Create the account
    await createUser({
      email,
      name: name ?? email.split('@')[0],
      password,
      role: invite.role,
    });

    return NextResponse.json({ ok: true, role: invite.role });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE — cancel a pending invite (founder only).
 * Consumed invites cannot be deleted (they are audit records).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const result = await deleteInvite(params.token);
    if (!result.deleted) {
      const status = result.reason === 'not_found' ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.reason }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
