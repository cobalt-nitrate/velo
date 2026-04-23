import { authOptions } from '@/lib/auth';
import { ASSIGNABLE_ROLES, getAllUsers, revokeUser, unrevokeUser } from '@/lib/users-registry';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

/** GET — list all registered users with their current resolved role. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const users = (await getAllUsers()).map((u) => ({
      email: u.email,
      name: u.name,
      image: u.image,
      role: u.role,
      firstSignIn: u.firstSignIn,
      lastSignIn: u.lastSignIn,
      revokedAt: u.revokedAt,
    }));

    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH — change a member's role.
 * Body: { email: string; role: AssignableRole }
 *
 * This works by updating the comma-separated env-var email lists:
 * - Remove the email from whichever list it was in
 * - Add it to the new list
 * - Save via patchStoredConnectorEnv (updates process.env immediately)
 *
 * The user's JWT will reflect the new role on their next session refresh (max 8h).
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const body = (await req.json()) as { email?: unknown; role?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const newRole = typeof body.role === 'string' ? body.role.trim() : '';

    if (!email || !/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    // Only non-founder roles can be assigned here.
    if (!(ASSIGNABLE_ROLES as string[]).includes(newRole)) {
      return NextResponse.json(
        { ok: false, error: `Invalid role '${newRole}'. Valid: ${ASSIGNABLE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Prevent demoting yourself
    if (email === session!.user!.email!.toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'Cannot change your own role' }, { status: 400 });
    }

    // DB-backed role assignment: update users.role and invalidate existing JWTs
    const updated = await prisma.user.update({
      where: { email },
      data: {
        role: newRole,
        sessionVersion: { increment: 1 },
      },
      select: { email: true, role: true },
    });

    return NextResponse.json({ ok: true, email: updated.email, role: updated.role });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE — revoke or restore a team member's access.
 * Body: { email: string; action: 'revoke' | 'restore' }
 */
export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const body = (await req.json()) as { email?: unknown; action?: unknown };
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (!email || !/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }
    if (action !== 'revoke' && action !== 'restore') {
      return NextResponse.json({ ok: false, error: "action must be 'revoke' or 'restore'" }, { status: 400 });
    }

    // Prevent self-revocation
    if (email === session!.user!.email!.toLowerCase()) {
      return NextResponse.json({ ok: false, error: 'Cannot revoke your own access' }, { status: 400 });
    }

    const founderEmail = session!.user!.email!;
    const updated = await (
      action === 'revoke' ? revokeUser(email, founderEmail) : unrevokeUser(email)
    );

    if (!updated) {
      // User hasn't signed in yet — create a minimal record so they're blocked
      if (action === 'revoke') {
        return NextResponse.json({
          ok: true,
          note: 'User has not signed in yet. They will be blocked on first attempt.',
        });
      }
      return NextResponse.json({ ok: false, error: 'User not found in registry' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, email, action });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
