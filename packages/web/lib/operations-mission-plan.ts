import type { OpsTriageDomain } from '@/lib/operations-triage';
import { isOpsTriageDomain, rowBusinessContextPlaybook } from '@/lib/operations-triage';

export type MissionToolStep = {
  tool_id: string;
  purpose: string;
};

export type MissionAgentPlan = {
  agent_id: string;
  label: string;
  mandate: string;
  analyze: string[];
  transform: string[];
  deliver_to: string[];
  tool_chain: MissionToolStep[];
};

export type OperationsMissionPlanResponse = {
  ok: true;
  mission_title: string;
  mission_summary: string;
  context_domain: OpsTriageDomain;
  context_row: Record<string, unknown>;
  orchestration_note: string;
  agent_plans: MissionAgentPlan[];
  llm_generated: boolean;
};

function isReadishToolId(id: string): boolean {
  return (
    id.includes('internal.platform.healthcheck') ||
    id.includes('.get_') ||
    id.includes('.find_') ||
    id.includes('.list') ||
    id.includes('.lookup') ||
    id.includes('get_pending') ||
    id.includes('get_overdue') ||
    id.includes('get_recent') ||
    id.includes('get_upcoming') ||
    id.includes('get_active') ||
    id.includes('get_latest_balance') ||
    id.includes('.get_active')
  );
}

function isWriteishToolId(id: string): boolean {
  return (
    id.includes('.create') ||
    id.includes('.update') ||
    id.includes('send_') ||
    id.includes('notifications.send')
  );
}

export function domainToAgentIds(domain: OpsTriageDomain, row: Record<string, unknown>): string[] {
  const ids = new Set<string>(['orchestrator']);
  const rowAgent = String(row.agent_id ?? '').trim();
  switch (domain) {
    case 'approvals':
      if (rowAgent && /^[a-z][a-z0-9-]*$/i.test(rowAgent)) ids.add(rowAgent);
      break;
    case 'compliance':
      ids.add('compliance');
      break;
    case 'ap':
      ids.add('ap-invoice');
      break;
    case 'ar_open':
    case 'ar_overdue':
      ids.add('ar-collections');
      break;
    case 'bank':
      ids.add('runway');
      break;
    case 'team':
      ids.add('hr');
      ids.add('helpdesk');
      break;
    case 'hires':
    case 'hr':
      ids.add('hr');
      break;
    default:
      break;
  }
  return Array.from(ids);
}

export type ResolvedAgentForMission = {
  id: string;
  label: string;
  description: string;
  tools: string[];
};

export function buildPlaybookMissionPlan(
  domain: OpsTriageDomain,
  row: Record<string, unknown>,
  resolved: ResolvedAgentForMission[],
  toolDesc: Map<string, string>
): Omit<OperationsMissionPlanResponse, 'llm_generated'> {
  const stake = rowBusinessContextPlaybook(domain, row);
  const keyHint =
    domain === 'approvals'
      ? String(row.approval_id ?? '').slice(0, 24)
      : domain.startsWith('ar')
        ? String(row.invoice_number ?? row.client_name ?? '').slice(0, 40)
        : domain === 'ap'
          ? String(row.invoice_number ?? row.vendor_name ?? '').slice(0, 40)
          : domain === 'compliance'
            ? String(row.label ?? row.type ?? '').slice(0, 40)
            : domain === 'bank'
              ? String(row.date ?? '').slice(0, 20)
              : domain === 'team'
                ? String(row.full_name ?? row.employee_id ?? '').slice(0, 40)
                : String((row as { task_id?: string }).task_id ?? row.employee_id ?? '').slice(0, 24);

  const mission_title = `Resolve · ${domain.replace(/_/g, ' ')}${keyHint ? ` · ${keyHint}` : ''}`;

  const mission_summary = stake;

  const orchestration_note =
    'The orchestrator interprets your goal, routes to the specialists below, and sequences tool calls (read Sheets health and context first, then propose writes or notifications). Sub-agents from each specialist’s config may be spawned for extraction or matching when needed. Human approval in Velo still gates high-impact writes.';

  const agent_plans: MissionAgentPlan[] = resolved.map((a) => {
    const tools = [...new Set(a.tools)].filter((t) => t && t !== 'internal.sub_agent.invoke');
    const reads = tools.filter(isReadishToolId);
    const writes = tools.filter(isWriteishToolId);
    const other = tools.filter((t) => !reads.includes(t) && !writes.includes(t));

    const analyze = [
      ...reads.slice(0, 12).map(
        (id) => `${id}: ${toolDesc.get(id) ?? 'Read or probe operational data.'}`
      ),
      ...other.slice(0, 4).map((id) => `${id}: ${toolDesc.get(id) ?? 'Supporting capability.'}`),
    ];

    const transform = writes
      .slice(0, 10)
      .map((id) => `${id}: ${toolDesc.get(id) ?? 'Mutate data or send outbound action.'}`);

    const tool_chain: MissionToolStep[] = [
      ...reads.slice(0, 8).map((tool_id) => ({
        tool_id,
        purpose: 'Gather facts and verify current sheet state before changing anything.',
      })),
      ...writes.slice(0, 6).map((tool_id) => ({
        tool_id,
        purpose: 'Apply updates, create records, or notify — subject to policy and approvals.',
      })),
    ];

    return {
      agent_id: a.id,
      label: a.label,
      mandate: a.description,
      analyze: analyze.length
        ? analyze
        : [
            'Use orchestrator context and specialist prompts to choose the right sheet reads for this row.',
          ],
      transform: transform.length
        ? transform
        : [
            'No direct write tools in config for this agent — work may be advisory or routed via another specialist.',
          ],
      deliver_to: [
        'Accurate updates in the linked Google Sheets workbooks where this row lives.',
        'Clear narrative back to you in chat (citations, deltas, and next risks).',
        'Approval requests when autopilot policy requires human sign-off.',
      ],
      tool_chain,
    };
  });

  return {
    ok: true,
    mission_title,
    mission_summary,
    context_domain: domain,
    context_row: row,
    orchestration_note,
    agent_plans,
  };
}

export function buildApprovedMissionUserPrompt(plan: OperationsMissionPlanResponse): string {
  const agentBlocks = plan.agent_plans.map((a) => {
    const chain = a.tool_chain.map((t) => t.tool_id).join(' → ');
    return [
      `### ${a.label} (${a.agent_id})`,
      `Mandate: ${a.mandate}`,
      `Analyze (indicative): ${a.analyze.slice(0, 8).join(' | ')}`,
      `Transform (indicative): ${a.transform.slice(0, 8).join(' | ')}`,
      `Deliver: ${a.deliver_to.join(' | ')}`,
      `Tool sequence (intent): ${chain}`,
    ].join('\n');
  });

  return [
    '[OPERATIONS MISSION — USER APPROVED]',
    '',
    `Domain: ${plan.context_domain}`,
    '',
    'Context row (source of truth):',
    JSON.stringify(plan.context_row, null, 2),
    '',
    'Business stake / objective:',
    plan.mission_summary,
    '',
    'How orchestration should work:',
    plan.orchestration_note,
    '',
    'Agent delegations:',
    ...agentBlocks,
    '',
    'Instructions: Act as orchestrator. Execute this mission: validate the row in Sheets where needed, involve the right specialists, chain tools read-first then writes, cite what you changed, and request human approval before any high-impact or policy-gated action.',
  ].join('\n');
}

export function parseMissionPlanBody(body: unknown): {
  domain: OpsTriageDomain;
  row: Record<string, unknown>;
} | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const d = String(b.domain ?? '');
  if (!isOpsTriageDomain(d)) return null;
  const row = b.row;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  return { domain: d, row: row as Record<string, unknown> };
}
