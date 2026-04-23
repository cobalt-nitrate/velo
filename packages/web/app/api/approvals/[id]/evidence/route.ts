import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canReview(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if (!canReview(role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const approvalId = params.id;
    const approval = await prisma.approvalRequest.findUnique({
      where: { approvalId },
      select: {
        approvalId: true,
        agentId: true,
        actionType: true,
        actionPayloadJson: true,
        confidenceScore: true,
        evidenceJson: true,
        createdAt: true,
        status: true,
      },
    });
    if (!approval) {
      return NextResponse.json({ ok: false, error: `Approval not found: ${approvalId}` }, { status: 404 });
    }

    const signalScores = await prisma.approvalSignalScore.findMany({
      where: { approvalId },
      orderBy: { score: 'desc' },
      take: 50,
      select: { signal: true, score: true, detail: true },
    });
    const storedEvidence = await prisma.approvalEvidenceItem.findMany({
      where: { approvalId },
      orderBy: { kind: 'asc' },
      take: 200,
      select: { id: true, kind: true, label: true, value: true, source: true, meta: true },
    });

    const includeRaw = (new URL(req.url).searchParams.get('include_raw') ?? '0') === '1';
    const actionPayload = safeJsonParse<Record<string, unknown>>(approval.actionPayloadJson ?? '{}', {});
    const evidence = safeJsonParse<unknown[]>(approval.evidenceJson ?? '[]', []);

    return NextResponse.json({
      ok: true,
      approval_id: approval.approvalId,
      agent_id: approval.agentId,
      action_type: approval.actionType,
      status: approval.status,
      confidence_score: approval.confidenceScore,
      action_payload: actionPayload,
      evidence_items:
        storedEvidence.length > 0
          ? storedEvidence.map((e) => ({
              id: e.id,
              kind: e.kind,
              label: e.label,
              value: e.value,
              source: e.source,
              meta: e.meta,
            }))
          : Array.isArray(evidence)
            ? evidence
            : [],
      signal_scores: signalScores.map((s) => ({
        signal: s.signal,
        score: s.score,
        detail: s.detail,
      })),
      ...(includeRaw
        ? {
            raw: {
              action_payload_json: approval.actionPayloadJson,
              evidence_json: approval.evidenceJson,
            },
          }
        : {}),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

