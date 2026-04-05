import { runWorkflowLinear } from '@velo/agents/workflow';
import { buildAgentContextFromBody } from '@/lib/build-agent-context';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST { workflowKey, context?, companyId?, actorId?, actorRole?, sessionId? }
 * Starts a config-driven linear workflow. On REQUEST_APPROVAL policy branch, status will be
 * WAITING_FOR_APPROVAL — use POST /api/workflows/resume after approval.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workflowKey = String(body.workflowKey ?? body.workflow_key ?? '').trim();
    if (!workflowKey) {
      return NextResponse.json({ error: 'workflowKey is required' }, { status: 400 });
    }
    const initialContext =
      body.context && typeof body.context === 'object' && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {};
    const ctx = buildAgentContextFromBody(body);
    const result = await runWorkflowLinear(workflowKey, initialContext, ctx);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
