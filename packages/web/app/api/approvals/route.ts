import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canReview(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if (!canReview(role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') ?? '20')));
    const status = (searchParams.get('status') ?? 'PENDING').trim();

    const where =
      status.toUpperCase() === 'ANY'
        ? {}
        : status
          ? { status: { in: [status, status.toUpperCase(), status.toLowerCase()] } }
          : {};

    const rows = await prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      approvals: rows.map((r) => ({
        approval_id: r.approvalId,
        agent_id: r.agentId,
        action_type: r.actionType,
        action_payload_json: r.actionPayloadJson,
        confidence_score: r.confidenceScore,
        evidence_json: r.evidenceJson,
        proposed_action_text: r.proposedActionText,
        created_at: r.createdAt,
        expires_at: r.expiresAt,
        status: r.status,
        approver_role: r.approverRole,
        resolved_by: r.resolvedBy,
        resolved_at: r.resolvedAt,
        resolution_notes: r.resolutionNotes,
        attachment_drive_urls_json: r.attachmentDriveUrlsJson,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
