/**
 * POST /api/auth/setup-founder
 *
 * One-time endpoint to create the founder account.
 * Security gates:
 * - Email must be in VELO_FOUNDER_EMAILS
 * - No user with that email may already exist (single-use)
 * - Password must be at least 10 characters
 */

import { splitEmails } from '@/lib/auth';
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

    const founderEmails = splitEmails(process.env.VELO_FOUNDER_EMAILS ?? '');
    if (!founderEmails.has(email)) {
      return NextResponse.json(
        { ok: false, error: 'This email is not authorized as a founder account.' },
        { status: 403 }
      );
    }

    if (password.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 10 characters.' },
        { status: 400 }
      );
    }

    // Single-use: fail if account already exists
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'A founder account with this email already exists. Sign in instead.' },
        { status: 409 }
      );
    }

    await createUser({ email, name: name || email.split('@')[0], password, role: 'founder' });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
