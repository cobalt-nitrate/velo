import { runWorkflowLinear } from '@velo/agents/workflow';
import type { AgentContext } from '@velo/core/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function buildContext(body: Record<string, unknown>): AgentContext {
  return {
    messages: [],
    company_id: String(body.companyId ?? 'demo-company'),
    actor_id: String(body.actorId ?? 'actor-anon'),
    actor_role: String(body.actorRole ?? 'finance_lead'),
    session_id: String(body.sessionId ?? `wf-${Date.now()}`),
    memory: {},
    observations: [],
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workflowKey = String(body.workflowId ?? body.workflow ?? 'ap_invoice_processing');
    const context = (body.context as Record<string, unknown>) ?? {};

    const result = await runWorkflowLinear(workflowKey, context, buildContext(body));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
