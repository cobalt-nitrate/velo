import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const tokenId = params.token;
    const tok = await prisma.documentAccessToken.findUnique({
      where: { tokenId },
      select: {
        tokenId: true,
        expiresAt: true,
        revokedAt: true,
        documentId: true,
        versionId: true,
        scope: true,
        recipientEmail: true,
        document: { select: { title: true, type: true, employeeEmail: true } },
        version: {
          select: {
            format: true,
            mime: true,
            storage: true,
            driveWebViewUrl: true,
            inlineDataUrl: true,
            versionId: true,
          },
        },
      },
    });
    if (!tok) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (tok.revokedAt) return NextResponse.json({ ok: false, error: 'Revoked' }, { status: 410 });
    if (tok.expiresAt.getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'Expired' }, { status: 410 });

    return NextResponse.json({
      ok: true,
      token_id: tok.tokenId,
      scope: tok.scope,
      document: {
        document_id: tok.documentId,
        type: tok.document?.type ?? '',
        title: tok.document?.title ?? '',
        employee_email: tok.document?.employeeEmail ?? '',
      },
      version: tok.version
        ? {
            version_id: tok.version.versionId,
            format: tok.version.format,
            mime: tok.version.mime,
            storage: tok.version.storage,
            drive_web_view_url: tok.version.driveWebViewUrl,
          }
        : null,
      preview_url: `/api/employee/docs/${encodeURIComponent(tok.tokenId)}/content`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

