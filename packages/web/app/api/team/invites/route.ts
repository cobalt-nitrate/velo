import { authOptions } from '@/lib/auth';
import { ALLOWED_INVITE_ROLES, createInvite, listInvites } from '@/lib/invites-store';
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

/** GET — list all pending / recently consumed invites (founder only). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    return NextResponse.json({ ok: true, invites: await listInvites() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * POST — create a new invite link (founder only).
 * Body: { role: InviteRole; email?: string; note?: string }
 *
 * Security:
 * - Only ASSIGNABLE_ROLES (no founder) can be invited
 * - email is optional; if present, only that Google account may accept
 * - note is truncated server-side to prevent excessively long strings
 * - Rate limiting: max 20 pending invites at a time (prevents enumeration spam)
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const body = (await req.json()) as { role?: unknown; email?: unknown; note?: unknown };

    const role = typeof body.role === 'string' ? body.role.trim() : '';
    if (!(ALLOWED_INVITE_ROLES as string[]).includes(role)) {
      return NextResponse.json(
        { ok: false, error: `Invalid role. Allowed: ${ALLOWED_INVITE_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Optional email scope — validate format if provided
    let scopedEmail: string | null = null;
    if (body.email && typeof body.email === 'string') {
      const trimmed = body.email.trim().toLowerCase();
      if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(trimmed)) {
        return NextResponse.json({ ok: false, error: 'Invalid email format' }, { status: 400 });
      }
      scopedEmail = trimmed;
    }

    // Rate limit: max 20 pending (non-consumed, non-expired) invites
    const existing = await listInvites();
    const pendingCount = existing.filter((i) => !i.consumedAt).length;
    if (pendingCount >= 20) {
      return NextResponse.json(
        { ok: false, error: 'Too many pending invites. Cancel some before creating new ones.' },
        { status: 429 }
      );
    }

    const note = typeof body.note === 'string' ? body.note : null;
    const invite = await createInvite(
      role as Parameters<typeof createInvite>[0],
      session!.user!.email!,
      scopedEmail,
      note
    );

    // Return the full invite including the token — the founder copies this URL
    const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? '';
    const inviteUrl = `${baseUrl}/team/invite?token=${invite.token}`;

    return NextResponse.json({ ok: true, invite, inviteUrl }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
