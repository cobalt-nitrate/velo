import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canView(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    if (!session?.user?.email) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    if (!canView(role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const documentId = params.id;
    const doc = await prisma.document.findUnique({
      where: { documentId },
      select: {
        documentId: true,
        type: true,
        title: true,
        subjectType: true,
        subjectId: true,
        employeeEmail: true,
        periodMonth: true,
        periodYear: true,
        tagsJson: true,
        latestVersionId: true,
        createdAt: true,
        createdBy: true,
        source: true,
      },
    });
    if (!doc) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        versionId: true,
        format: true,
        mime: true,
        sha256: true,
        sizeBytes: true,
        storage: true,
        driveWebViewUrl: true,
        driveFileId: true,
        inlineDataUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      document: {
        document_id: doc.documentId,
        type: doc.type,
        title: doc.title,
        subject_type: doc.subjectType,
        subject_id: doc.subjectId,
        employee_email: doc.employeeEmail,
        period_month: doc.periodMonth,
        period_year: doc.periodYear,
        tags_json: doc.tagsJson,
        latest_version_id: doc.latestVersionId,
        created_at: doc.createdAt.toISOString(),
        created_by: doc.createdBy,
        source: doc.source,
      },
      versions: versions.map((v) => ({
        version_id: v.versionId,
        format: v.format,
        mime: v.mime,
        sha256: v.sha256,
        size_bytes: v.sizeBytes,
        storage: v.storage,
        drive_file_id: v.driveFileId,
        drive_web_view_url: v.driveWebViewUrl,
        inline_data_url: v.inlineDataUrl,
        created_at: v.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

