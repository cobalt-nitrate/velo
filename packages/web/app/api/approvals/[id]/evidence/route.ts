import { authOptions } from '@/lib/auth';
import { assembleApprovalEvidence } from '@/lib/approvals/evidence';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function canReview(role: string | undefined): boolean {
  return role === 'founder' || role === 'finance_lead' || role === 'hr_lead' || role === 'manager';
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
    const bundle = await assembleApprovalEvidence(approvalId);
    if (!bundle) {
      return NextResponse.json({ ok: false, error: `Approval not found: ${approvalId}` }, { status: 404 });
    }

    const includeRaw = (new URL(req.url).searchParams.get('include_raw') ?? '0') === '1';

    return NextResponse.json({
      ok: true,
      approval_id: bundle.approval_id,
      agent_id: bundle.agent_id,
      action_type: bundle.action_type,
      status: bundle.status,
      confidence_score: bundle.confidence_score,
      sections: bundle.sections,
      signal_scores: bundle.signals,
      ...(includeRaw
        ? {
            raw: bundle.raw,
          }
        : {}),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

