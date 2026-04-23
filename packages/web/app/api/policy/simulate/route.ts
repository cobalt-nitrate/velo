import { loadConfig } from '@velo/core/config';
import { PolicyEngine } from '@velo/core/policy-engine';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** POST { tool_id, confidence?, amount_inr?, actor_role?, agent_id? } — dry-run PolicyEngine decision. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const toolId = String(body.tool_id ?? 'data.ap_invoices.create');
    const confidence = typeof body.confidence === 'number' ? body.confidence : 0.82;
    const actorRole = String(body.actor_role ?? 'founder');
    const agentId = String(body.agent_id ?? 'ap-invoice');

    const base = loadConfig('policies/autopilot') as ConstructorParameters<
      typeof PolicyEngine
    >[0];
    const autopilot = {
      ...base,
      payment_auto_threshold_inr:
        typeof body.payment_auto_threshold_inr === 'number'
          ? (body.payment_auto_threshold_inr as number)
          : base.payment_auto_threshold_inr,
    };

    const policyEngine = new PolicyEngine(autopilot);
    const parts = toolId.split('.');
    const module = parts[1] ?? 'unknown';
    const action = parts[2] ?? 'execute';
    const amountInr =
      typeof body.amount_inr === 'number' ? body.amount_inr : undefined;

    const policyResult = policyEngine.evaluate({
      action: { tool_id: toolId, parameters: {} },
      confidence,
      actor_role: actorRole,
      agent_id: agentId,
      metadata: {
        amount_inr: amountInr,
        action_type: `${module}.${action}`,
        module,
        is_filing_action: toolId.includes('filing') || toolId.includes('file_'),
      },
    });

    return NextResponse.json({
      ok: true,
      policy_result: policyResult,
      payment_auto_threshold_inr: autopilot.payment_auto_threshold_inr,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
