import {
  agentLabel,
  buildIntegrationTriageRows,
  isOpsTriageDomain,
  playbookFallback,
  type OpsTriageDomain,
  type OperationsTriageResponse,
  type TriageLlmShape,
} from '@/lib/operations-triage';
import { runIntegrationHealthQuick } from '@velo/tools/platform-health';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Model sometimes ignores instructions and returns product copy — swap for row-specific playbook. */
function looksLikeGenericVeloPitch(s: string): boolean {
  return (
    /velo is an ai[- ]?assisted/i.test(s) ||
    /operations view pulls/i.test(s) ||
    /connected google sheets so (?:finance|people)/i.test(s) ||
    /before anything is executed or money moves/i.test(s)
  );
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.LLM_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    'https://integrate.api.nvidia.com/v1';
  if (!apiKey?.trim()) {
    throw new Error('LLM_API_KEY / OPENAI_API_KEY missing');
  }
  return new OpenAI({ apiKey, baseURL });
}

function resolveTriageModel(): string {
  const m = process.env.LLM_MODEL_TRIAGE ?? process.env.LLM_MODEL_DEFAULT;
  if (m?.trim()) return m.trim();
  throw new Error('Set LLM_MODEL_DEFAULT or LLM_MODEL_TRIAGE for triage summaries');
}

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return s.trim();
}

function parseTriageJson(text: string): TriageLlmShape | null {
  try {
    const s = stripJsonFence(text);
    const o = JSON.parse(s) as unknown;
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    const biz = rec.business_context;
    const business_context =
      typeof biz === 'string' && biz.trim() ? biz.trim() : '';
    const what = rec.what_it_means;
    const actions = rec.recommended_actions;
    const focus = rec.agent_focus;
    if (typeof what !== 'string' || !Array.isArray(actions)) return null;
    const agent_focus: { agent_id: string; why: string }[] = [];
    if (Array.isArray(focus)) {
      for (const x of focus) {
        if (!x || typeof x !== 'object') continue;
        const r = x as Record<string, unknown>;
        if (typeof r.agent_id === 'string' && typeof r.why === 'string') {
          agent_focus.push({ agent_id: r.agent_id, why: r.why });
        }
      }
    }
    return {
      business_context,
      what_it_means: what.trim(),
      recommended_actions: actions.filter((a): a is string => typeof a === 'string').map((a) => a.trim()),
      agent_focus,
    };
  } catch {
    return null;
  }
}

async function runTriageLlm(domain: OpsTriageDomain, row: Record<string, unknown>): Promise<TriageLlmShape | null> {
  let client: OpenAI;
  let model: string;
  try {
    client = getOpenAI();
    model = resolveTriageModel();
  } catch {
    return null;
  }
  const system = `You are a senior finance and back-office triage assistant for Indian SMB operators.
Output ONLY a single JSON object, no markdown, no prose outside JSON.
Schema:
{
  "business_context": string (required: 2–4 short sentences ONLY about THIS ROW — name real entities from the row (vendor, client, employee, obligation label, bank line, approval id), reference amounts/dates/status fields when present, and state the business stake: cash, working capital, statutory risk, control, or people impact. Do NOT describe Velo, the Operations product, or generic "why dashboards exist".),
  "what_it_means": string (2–4 short sentences; operational reading of the same row, complementary to business_context),
  "recommended_actions": string[] (3–5 crisp imperatives; concrete next steps for a human operator),
  "agent_focus": [ { "agent_id": string, "why": string } ]
}
Valid agent_id values (use only where relevant): orchestrator, compliance, ap-invoice, ar-collections, hr, runway, helpdesk, payroll.
Be precise and non-alarmist. Do not invent amounts or dates not in the row. Do not give legal or tax advice.`;

  const user = `Operations tab (for categorization only): ${domain}
Row fields (use these for business_context): ${JSON.stringify(row).slice(0, 4000)}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: 1100,
      temperature: 0.25,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return null;
    return parseTriageJson(content);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { domain?: string; row?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const domainRaw = String(body.domain ?? '');
  if (!isOpsTriageDomain(domainRaw)) {
    return NextResponse.json({ ok: false, error: 'Invalid domain' }, { status: 400 });
  }
  const domain = domainRaw;
  const row =
    body.row && typeof body.row === 'object' && !Array.isArray(body.row)
      ? (body.row as Record<string, unknown>)
      : null;
  if (!row || Object.keys(row).length === 0) {
    return NextResponse.json({ ok: false, error: 'row object required' }, { status: 400 });
  }

  const health = await runIntegrationHealthQuick();
  const integrations = buildIntegrationTriageRows(health.checks);
  const playbook = playbookFallback(domain, row);

  let triage: TriageLlmShape | null = null;
  let llm_generated = false;
  try {
    triage = await runTriageLlm(domain, row);
    if (triage && triage.what_it_means.length > 0) llm_generated = true;
  } catch {
    triage = null;
  }
  if (!triage || triage.recommended_actions.length === 0) {
    triage = playbook;
    llm_generated = false;
  }

  if (triage.agent_focus.length === 0) {
    triage = {
      ...triage,
      agent_focus: playbook.agent_focus,
    };
  }

  if (!triage.business_context.trim() || looksLikeGenericVeloPitch(triage.business_context)) {
    triage = {
      ...triage,
      business_context: playbook.business_context,
    };
  }

  const agents_resolved = triage.agent_focus.map((a) => ({
    agent_id: a.agent_id,
    label: agentLabel(a.agent_id),
    why: a.why,
  }));

  const payload: OperationsTriageResponse = {
    ok: true,
    domain,
    triage,
    integrations,
    agents_resolved,
    llm_generated,
    health_generated_at: health.generated_at,
  };

  return NextResponse.json(payload);
}
