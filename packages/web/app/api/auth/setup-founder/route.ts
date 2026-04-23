/**
 * POST /api/auth/setup-founder
 *
 * One-time endpoint to create the founder account.
 * Security gates:
 * - Only allowed when there are no existing users (single-use bootstrap)
 * - Password must be at least 10 characters
 */

import { createUser } from '@/lib/users-registry';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown; name?: unknown; password?: unknown };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : null;
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email address.' }, { status: 400 });
    }

    // One-time bootstrap: only create a founder if this is the first user in the system.
    const existingAnyUser = await prisma.user.findFirst({ select: { id: true } });
    if (existingAnyUser) {
      return NextResponse.json(
        { ok: false, error: 'Founder already set up. Sign in or ask a founder to invite you.' },
        { status: 409 }
      );
    }

    if (password.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 10 characters.' },
        { status: 400 }
      );
    }

    await createUser({ email, name: name || email.split('@')[0], password, role: 'founder' });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
