import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const tokenId = params.token;
    const tok = await prisma.documentAccessToken.findUnique({
      where: { tokenId },
      select: {
        expiresAt: true,
        revokedAt: true,
        version: {
          select: {
            format: true,
            mime: true,
            storage: true,
            driveWebViewUrl: true,
            inlineDataUrl: true,
          },
        },
      },
    });
    if (!tok || !tok.version) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (tok.revokedAt) return NextResponse.json({ ok: false, error: 'Revoked' }, { status: 410 });
    if (tok.expiresAt.getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'Expired' }, { status: 410 });

    if (tok.version.storage === 'drive' && tok.version.driveWebViewUrl) {
      return NextResponse.redirect(tok.version.driveWebViewUrl);
    }
    if (tok.version.storage === 'inline' && tok.version.inlineDataUrl) {
      return NextResponse.redirect(tok.version.inlineDataUrl);
    }

    return NextResponse.json({ ok: false, error: 'Content unavailable' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

