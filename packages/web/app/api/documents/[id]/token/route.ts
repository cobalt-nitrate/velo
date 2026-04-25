import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

function canView(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    const actor = session?.user?.email ?? '';
    if (!actor) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    if (!canView(role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { expiry_hours?: unknown; scope?: unknown; recipient_email?: unknown };
    const expiryHours = clamp(Number(body.expiry_hours ?? 72), 1, 24 * 30);
    const scope = String(body.scope ?? 'preview') === 'download' ? 'download' : 'preview';
    const recipientEmail = typeof body.recipient_email === 'string' ? body.recipient_email.trim().toLowerCase() : '';

    const documentId = params.id;
    const doc = await prisma.document.findUnique({
      where: { documentId },
      select: { documentId: true, latestVersionId: true },
    });
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const tokenId = `dt_${crypto.randomBytes(18).toString('hex')}`;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    await prisma.documentAccessToken.create({
      data: {
        tokenId,
        documentId: doc.documentId,
        versionId: doc.latestVersionId,
        scope,
        recipientEmail,
        createdBy: actor,
        expiresAt,
      },
    });

    const base = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return NextResponse.json({
      ok: true,
      token_id: tokenId,
      expires_at: expiresAt.toISOString(),
      url: `${base}/employee/docs/${encodeURIComponent(tokenId)}`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

