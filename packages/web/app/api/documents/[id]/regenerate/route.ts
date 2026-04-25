import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { generatePdfDocument } from '@velo/tools/documents';

export const runtime = 'nodejs';

function canWrite(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    const actor = session?.user?.email ?? '';
    if (!actor) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    if (!canWrite(role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const documentId = params.id;
    const doc = await prisma.document.findUnique({
      where: { documentId },
      select: { latestVersionId: true },
    });
    if (!doc?.latestVersionId) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    const latest = await prisma.documentVersion.findUnique({
      where: { versionId: doc.latestVersionId },
      select: { renderParamsJson: true },
    });
    const raw = latest?.renderParamsJson ?? '';
    let paramsObj: Record<string, unknown>;
    try {
      paramsObj = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      paramsObj = {};
    }

    // Guardrail: regen only if we have a tool id
    const toolId = String(paramsObj.tool_id ?? '');
    if (!toolId) {
      return NextResponse.json({ ok: false, error: 'Cannot regenerate: missing tool_id' }, { status: 409 });
    }

    // Force the existing stable doc id context into params (helps linkages)
    const result = (await generatePdfDocument({
      ...paramsObj,
      actor_id: actor,
      tool_id: toolId,
      document_id: documentId,
    })) as any;

    if (!result?.ok) {
      return NextResponse.json({ ok: false, error: String(result?.error ?? 'generation failed') }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      document_id: result.document_id ?? documentId,
      version_id: result.version_id ?? null,
      url: result.url ?? null,
      storage: result.storage ?? null,
      generated_at: result.generated_at ?? new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

