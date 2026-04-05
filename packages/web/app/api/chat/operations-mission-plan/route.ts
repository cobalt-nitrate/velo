import { loadAgentConfig } from '@velo/core/config';
import type { AgentConfig } from '@velo/core/types';
import {
  buildPlaybookMissionPlan,
  domainToAgentIds,
  parseMissionPlanBody,
  type MissionAgentPlan,
  type OperationsMissionPlanResponse,
  type ResolvedAgentForMission,
} from '@/lib/operations-mission-plan';
import type { OpsTriageDomain } from '@/lib/operations-triage';
import { getRuntimeTools } from '@velo/tools';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

function resolveModel(): string {
  const m = process.env.LLM_MODEL_MISSION ?? process.env.LLM_MODEL_TRIAGE ?? process.env.LLM_MODEL_DEFAULT;
  if (m?.trim()) return m.trim();
  throw new Error('Set LLM_MODEL_DEFAULT or LLM_MODEL_MISSION');
}

function stripJsonFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return s.trim();
}

function enrichPlansWithPlaybook(
  llmPlans: MissionAgentPlan[],
  playbookPlans: MissionAgentPlan[]
): MissionAgentPlan[] {
  const pbMap = new Map(playbookPlans.map((p) => [p.agent_id, p]));
  return llmPlans.map((p) => {
    const pb = pbMap.get(p.agent_id);
    if (!pb) return p;
    return {
      ...p,
      analyze: p.analyze.filter(Boolean).length >= 2 ? p.analyze : pb.analyze,
      transform: p.transform.filter(Boolean).length ? p.transform : pb.transform,
      deliver_to: p.deliver_to.filter(Boolean).length ? p.deliver_to : pb.deliver_to,
      tool_chain: p.tool_chain.length ? p.tool_chain : pb.tool_chain,
    };
  });
}

function resolveAgentsForMission(
  domain: OpsTriageDomain,
  row: Record<string, unknown>
): ResolvedAgentForMission[] {
  const ids = domainToAgentIds(domain, row);
  const out: ResolvedAgentForMission[] = [];
  for (const id of ids) {
    try {
      const cfg = loadAgentConfig(id) as AgentConfig;
      out.push({
        id: cfg.id,
        label: cfg.label,
        description: cfg.description,
        tools: Array.isArray(cfg.tools) ? cfg.tools : [],
      });
    } catch {
      /* unknown agent id */
    }
  }
  return out;
}

function parseLlmMission(
  text: string,
  resolved: ResolvedAgentForMission[],
  toolDesc: Map<string, string>
): Omit<OperationsMissionPlanResponse, 'context_domain' | 'context_row' | 'llm_generated'> | null {
  try {
    const o = JSON.parse(stripJsonFence(text)) as unknown;
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    const title = rec.mission_title;
    const summary = rec.mission_summary;
    const orch = rec.orchestration_note;
    const plans = rec.agent_plans;
    if (typeof title !== 'string' || typeof summary !== 'string' || typeof orch !== 'string')
      return null;
    if (!Array.isArray(plans)) return null;

    const allowed = new Map(resolved.map((r) => [r.id, new Set(r.tools)]));

    const agent_plans: MissionAgentPlan[] = [];
    for (const p of plans) {
      if (!p || typeof p !== 'object') continue;
      const pr = p as Record<string, unknown>;
      const agent_id = String(pr.agent_id ?? '');
      if (!agent_id || !allowed.has(agent_id)) continue;
      const toolAllow = allowed.get(agent_id)!;
      const labelFromCfg = resolved.find((r) => r.id === agent_id)?.label ?? agent_id;
      const mandate = typeof pr.mandate === 'string' ? pr.mandate : '';

      const analyze = Array.isArray(pr.analyze)
        ? pr.analyze.filter((x): x is string => typeof x === 'string').slice(0, 16)
        : [];
      const transform = Array.isArray(pr.transform)
        ? pr.transform.filter((x): x is string => typeof x === 'string').slice(0, 16)
        : [];
      const deliver_to = Array.isArray(pr.deliver_to)
        ? pr.deliver_to.filter((x): x is string => typeof x === 'string').slice(0, 10)
        : [];

      const chainRaw = Array.isArray(pr.tool_chain) ? pr.tool_chain : [];
      const tool_chain: { tool_id: string; purpose: string }[] = [];
      for (const c of chainRaw) {
        if (!c || typeof c !== 'object') continue;
        const cr = c as Record<string, unknown>;
        const tid = String(cr.tool_id ?? '');
        const purpose = typeof cr.purpose === 'string' ? cr.purpose : '';
        if (tid && (toolAllow.has(tid) || tid === 'internal.sub_agent.invoke')) {
          tool_chain.push({
            tool_id: tid,
            purpose: purpose || (toolDesc.get(tid) ?? 'Tool step'),
          });
        }
      }

      agent_plans.push({
        agent_id,
        label: typeof pr.label === 'string' ? pr.label : labelFromCfg,
        mandate: mandate || resolved.find((r) => r.id === agent_id)?.description || '',
        analyze: analyze.length
          ? analyze
          : ['Derive concrete reads from this agent’s configured tools for the row.'],
        transform: transform.length
          ? transform
          : ['Apply writes or notifications only with policy clearance.'],
        deliver_to: deliver_to.length
          ? deliver_to
          : [
              'Updated Google Sheets truth for this row’s workbook.',
              'Clear operator-facing summary in chat.',
            ],
        tool_chain,
      });
    }

    if (agent_plans.length === 0) return null;

    return {
      ok: true,
      mission_title: title.trim(),
      mission_summary: summary.trim(),
      orchestration_note: orch.trim(),
      agent_plans,
    };
  } catch {
    return null;
  }
}

async function runMissionLlm(
  domain: string,
  row: Record<string, unknown>,
  resolved: ResolvedAgentForMission[],
  toolDesc: Map<string, string>
): Promise<Omit<OperationsMissionPlanResponse, 'context_domain' | 'context_row' | 'llm_generated'> | null> {
  let client: OpenAI;
  let model: string;
  try {
    client = getOpenAI();
    model = resolveModel();
  } catch {
    return null;
  }

  const agentBlocks = resolved.map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    tools: a.tools.map((tid) => ({
      id: tid,
      about: toolDesc.get(tid) ?? '(no description)',
    })),
  }));

  const system = `You are Velo’s mission orchestration architect. You design how specialist agents chain READ and WRITE tools to resolve ONE operational row.

Output ONLY valid JSON (no markdown). Shape:
{
  "mission_title": "short imperative title for this row",
  "mission_summary": "2–4 sentences in plain English for a non-technical reader: business stake for THIS ROW only (entities, amounts/dates if in row). No tool_id strings, no JSON field names, no connector acronyms unless unavoidable.",
  "orchestration_note": "2–4 sentences in plain English: who goes first, what gets checked before anything is changed, when a human approval might be needed. Same vocabulary rules as mission_summary.",
  "agent_plans": [
    {
      "agent_id": "must match one of provided agent ids",
      "label": "optional override; else we use config label",
      "mandate": "one sentence what this agent does for THIS row",
      "analyze": ["bullet strings: what to inspect or verify; use everyday words first, optional tool hint after a colon only when it helps"],
      "transform": ["bullet strings: what to update, file, or notify; same tone as analyze"],
      "deliver_to": ["where results must land: sheets tabs, approvals queue, human summary", "..."],
      "tool_chain": [ { "tool_id": "must be from that agent's tool list", "purpose": "why this step in order" } ]
    }
  ]
}

Rules:
- tool_chain must only use tool_ids that appear under that agent in the payload (plus internal.sub_agent.invoke if listed).
- Prefer concrete tool ids from the lists; order read probes before writes.
- Do not market Velo. Be specific to the row JSON.
- Keep mission_summary and orchestration_note free of snake_case identifiers; reserve concrete tool ids for tool_chain only.
- ${agentBlocks.length} agents maximum in agent_plans (one entry per agent in payload).`;

  const user = `Domain: ${domain}\n\nRow:\n${JSON.stringify(row, null, 2).slice(0, 4500)}\n\nAgents & tools:\n${JSON.stringify(agentBlocks, null, 2).slice(0, 18_000)}`;

  try {
    const completion = await client.chat.completions.create({
      model,
      max_tokens: 2200,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return null;
    return parseLlmMission(content, resolved, toolDesc);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = parseMissionPlanBody(body);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'domain and row required' }, { status: 400 });
  }
  const { domain, row } = parsed;

  const resolved = resolveAgentsForMission(domain, row);
  if (resolved.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Could not load agent configs for this mission' },
      { status: 500 }
    );
  }

  const toolDesc = new Map(getRuntimeTools().map((t) => [t.id, t.description]));

  const playbookCore = buildPlaybookMissionPlan(domain, row, resolved, toolDesc);

  const playbookFull: OperationsMissionPlanResponse = {
    ...playbookCore,
    context_domain: domain,
    context_row: row,
    llm_generated: false,
  };

  const llmCore = await runMissionLlm(domain, row, resolved, toolDesc);

  let payload: OperationsMissionPlanResponse;

  if (llmCore && llmCore.agent_plans.length > 0) {
    const have = new Set(llmCore.agent_plans.map((p) => p.agent_id));
    const mergedPlans = [
      ...enrichPlansWithPlaybook(llmCore.agent_plans, playbookCore.agent_plans),
      ...playbookCore.agent_plans.filter((p) => !have.has(p.agent_id)),
    ];
    payload = {
      ok: true,
      mission_title: llmCore.mission_title.trim() || playbookCore.mission_title,
      mission_summary: llmCore.mission_summary.trim() || playbookCore.mission_summary,
      orchestration_note: llmCore.orchestration_note.trim() || playbookCore.orchestration_note,
      agent_plans: mergedPlans,
      context_domain: domain,
      context_row: row,
      llm_generated: true,
    };
  } else {
    payload = playbookFull;
  }

  return NextResponse.json(payload);
}
