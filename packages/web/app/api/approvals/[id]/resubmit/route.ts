import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@velo/tools/notifications';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canReview(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
}

function newApprovalId(): string {
  return `apr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function addHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { actor_role?: string } | undefined)?.actor_role;
    const actor = session?.user?.email ?? '';
    if (!actor) return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    if (!canReview(role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const approvalId = params.id;
    const existing = await prisma.approvalRequest.findUnique({
      where: { approvalId },
      select: {
        approvalId: true,
        agentId: true,
        actionType: true,
        actionPayloadJson: true,
        confidenceScore: true,
        evidenceJson: true,
        proposedActionText: true,
        approverRole: true,
        attachmentDriveUrlsJson: true,
        status: true,
        supersededByApprovalId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: `Approval not found: ${approvalId}` }, { status: 404 });
    }

    const st = String(existing.status ?? '').trim().toUpperCase();
    if (st === 'PENDING' || st === '') {
      return NextResponse.json(
        { ok: false, error: 'Approval is still pending; resubmit is only for resolved/expired items.' },
        { status: 409 }
      );
    }
    if (existing.supersededByApprovalId?.trim()) {
      return NextResponse.json(
        { ok: false, error: `Already resubmitted as ${existing.supersededByApprovalId}` },
        { status: 409 }
      );
    }

    const nextId = newApprovalId();
    const now = new Date().toISOString();
    const expiresAt = addHoursIso(48);

    const created = await prisma.$transaction(async (tx) => {
      const next = await tx.approvalRequest.create({
        data: {
          approvalId: nextId,
          agentId: existing.agentId,
          actionType: existing.actionType,
          actionPayloadJson: existing.actionPayloadJson,
          confidenceScore: existing.confidenceScore,
          evidenceJson: existing.evidenceJson,
          proposedActionText: existing.proposedActionText,
          createdAt: now,
          expiresAt,
          status: 'PENDING',
          approverRole: existing.approverRole,
          resolvedBy: '',
          resolvedAt: '',
          resolutionNotes: '',
          attachmentDriveUrlsJson: existing.attachmentDriveUrlsJson,
          resubmittedFromApprovalId: existing.approvalId,
          supersededByApprovalId: '',
        },
        select: { approvalId: true },
      });

      await tx.approvalRequest.update({
        where: { approvalId: existing.approvalId },
        data: { supersededByApprovalId: nextId },
      });

      await tx.approvalEvent.createMany({
        data: [
          {
            approvalId: existing.approvalId,
            type: 'RESUBMITTED',
            actorId: actor,
            actorRole: role ?? '',
            notes: `resubmitted_as=${nextId}`,
            payload: { resubmitted_as: nextId, at: now },
          },
          {
            approvalId: nextId,
            type: 'CREATED',
            actorId: actor,
            actorRole: role ?? '',
            notes: `resubmitted_from=${existing.approvalId}`,
            payload: { resubmitted_from: existing.approvalId, expires_at: expiresAt },
          },
        ],
      });

      return next;
    });

    // Slack deep link (best-effort)
    try {
      const companyId = process.env.VELO_COMPANY_ID?.trim() || 'demo-company';
      const title = existing.proposedActionText || `Approve: ${existing.actionType}`;
      const appUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      const reviewUrl = `${appUrl}/approvals/${encodeURIComponent(created.approvalId)}`;
      await sendNotification({
        tool_id: 'notifications.send_approval_request',
        company_id: companyId,
        approver_role: existing.approverRole,
        approval_id: created.approvalId,
        title: `Resubmitted: ${title}`,
        message: `This approval was resubmitted and needs review:\n${reviewUrl}`,
        channel: 'slack',
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true, approval_id: created.approvalId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

