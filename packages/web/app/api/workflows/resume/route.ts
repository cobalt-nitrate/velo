import { resumeWorkflowAfterApproval } from '@velo/agents/workflow';
import { buildAgentContextFromBody } from '@/lib/build-agent-context';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST { run_id, companyId?, actorId?, actorRole?, sessionId?, skipApprovalCheck? }
 * Requires the matching approval row to be APPROVED unless skipApprovalCheck is true (tests only).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const runId = String(body.run_id ?? '').trim();
    if (!runId) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 });
    }
    const ctx = buildAgentContextFromBody(body);
    const result = await resumeWorkflowAfterApproval(runId, ctx, {
      skipApprovalCheck: body.skipApprovalCheck === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
