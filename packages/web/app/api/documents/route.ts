import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canView(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    if (!session?.user?.email) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    if (!canView(role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') ?? '').trim();
    const employeeEmail = (searchParams.get('employee_email') ?? '').trim().toLowerCase();
    const q = (searchParams.get('q') ?? '').trim();
    const cursor = (searchParams.get('cursor') ?? '').trim();
    const limit = clamp(Number(searchParams.get('limit') ?? 50), 1, 100);

    const where: any = {};
    if (type) where.type = type;
    if (employeeEmail) where.employeeEmail = employeeEmail;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { subjectId: { contains: q, mode: 'insensitive' } },
        { documentId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { documentId: cursor }, skip: 1 } : {}),
      select: {
        documentId: true,
        type: true,
        title: true,
        subjectType: true,
        subjectId: true,
        employeeEmail: true,
        periodMonth: true,
        periodYear: true,
        latestVersionId: true,
        createdAt: true,
        createdBy: true,
        source: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nextCursor = hasMore ? page[page.length - 1]?.documentId ?? null : null;

    return NextResponse.json({
      ok: true,
      documents: page.map((d) => ({
        document_id: d.documentId,
        type: d.type,
        title: d.title,
        subject_type: d.subjectType,
        subject_id: d.subjectId,
        employee_email: d.employeeEmail,
        period_month: d.periodMonth,
        period_year: d.periodYear,
        latest_version_id: d.latestVersionId,
        created_at: d.createdAt.toISOString(),
        created_by: d.createdBy,
        source: d.source,
      })),
      next_cursor: nextCursor,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

