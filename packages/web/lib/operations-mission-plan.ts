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

function toolSet(tools: string[]): Set<string> {
  return new Set(tools.filter(Boolean));
}

function pickTool(tools: Set<string>, id: string): string | null {
  return tools.has(id) ? id : null;
}

function pickFirstByPrefix(tools: Set<string>, prefixes: string[]): string | null {
  for (const id of tools) {
    for (const p of prefixes) {
      if (id.startsWith(p)) return id;
    }
  }
  return null;
}

function inferApprovalKind(row: Record<string, unknown>): 'payment' | 'generic' {
  const actionType = String(row.action_type ?? '').toLowerCase();
  const proposal = String(row.proposed_action_text ?? '').toLowerCase();
  const blob = `${actionType} ${proposal}`;
  if (/(issue[_ -]?payment|payment|neft|imps|rtgs|payout|transfer)/i.test(blob)) return 'payment';
  return 'generic';
}

function buildOrchestrationNote(domain: OpsTriageDomain, row: Record<string, unknown>): string {
  if (domain === 'approvals') {
    const kind = inferApprovalKind(row);
    if (kind === 'payment') {
      return [
        'Verify the approval details (amount, beneficiary, timing) and whether anything is missing in evidence.',
        'Check current cash position / recent bank activity to ensure the payout is feasible and not duplicated.',
        'If anything is unclear, ask for one clarification before doing anything irreversible; then approve or reject with a short audit note.',
      ].join(' ');
    }
    return [
      'Verify what change is being requested and what evidence supports it.',
      'Confirm it matches policy and won’t create duplicates or inconsistencies.',
      'If needed, ask for one clarification; then approve or reject with an audit note.',
    ].join(' ');
  }
  return [
    'Start by confirming the row’s facts from the system of record and checking integration health.',
    'Then choose the smallest set of reads that reduce uncertainty for this exact row (amounts, dates, counterparties, status).',
    'Only after that, propose or execute writes/notifications that are clearly justified and policy-safe.',
  ].join(' ');
}

function buildSelectedPlan(
  domain: OpsTriageDomain,
  row: Record<string, unknown>,
  agentId: string,
  tools: string[],
  toolDesc: Map<string, string>
): {
  analyze: string[];
  transform: string[];
  deliver_to: string[];
  tool_chain: MissionToolStep[];
} {
  const set = toolSet(tools);

  const chain: MissionToolStep[] = [];
  const analyze: string[] = [];
  const transform: string[] = [];

  const health = pickTool(set, 'internal.platform.healthcheck');
  if (health) {
    chain.push({ tool_id: health, purpose: 'Confirm integrations and current operational snapshot.' });
    analyze.push('Confirm integrations and current system status (database, approvals queue, optional Drive/LLM).');
  }

  // Domain-specific, minimal reads (avoid "list everything")
  if (domain === 'approvals') {
    const kind = inferApprovalKind(row);
    if (kind === 'payment') {
      const bal = pickFirstByPrefix(set, ['data.bank_transactions.get_latest_balance']);
      const recent = pickFirstByPrefix(set, ['data.bank_transactions.get_recent']);
      const payee = pickFirstByPrefix(set, ['data.bank_payees.lookup']);
      if (bal) chain.push({ tool_id: bal, purpose: 'Sanity-check available cash before scheduling payout.' });
      if (recent) chain.push({ tool_id: recent, purpose: 'Look for duplicates / recent related debits.' });
      if (payee) chain.push({ tool_id: payee, purpose: 'Verify beneficiary details (avoid wrong-account payouts).' });
      if (bal || recent) analyze.push('Check cash position and recent bank activity for duplicates or insufficient balance.');
      if (payee) analyze.push('Verify beneficiary / payee details match the approval request.');
    } else {
      analyze.push('Validate the request against policy and confirm evidence is sufficient for the decision.');
    }

    // Deliverables for approvals are not "update sheets"
    return {
      analyze,
      transform: transform.length ? transform : ['Approve or reject with a clear audit note if/when you decide.'],
      deliver_to: [
        'Decision recorded on the approval (status + resolver + timestamp + notes).',
        'Clear operator-facing summary in chat: what was verified, what was decided, and why.',
      ],
      tool_chain: chain,
    };
  }

  // Default: keep generic but bounded
  const genericRead = [...set].filter(isReadishToolId).slice(0, 4);
  for (const tool_id of genericRead) {
    chain.push({ tool_id, purpose: 'Read the minimum facts needed for this row.' });
    analyze.push(toolDesc.get(tool_id) ?? 'Read operational data relevant to the row.');
  }
  const genericWrite = [...set].filter(isWriteishToolId).slice(0, 2);
  for (const tool_id of genericWrite) {
    chain.push({ tool_id, purpose: 'Apply a targeted update or notification if justified.' });
    transform.push(toolDesc.get(tool_id) ?? 'Apply a targeted update or send a notification.');
  }

  return {
    analyze: analyze.length ? analyze : ['Identify the smallest set of checks needed to act on this row safely.'],
    transform: transform.length
      ? transform
      : ['Propose a concrete next action; only execute writes after policy and approval gates.'],
    deliver_to: [
      'Accurate updates in the system of record for this row (database and enabled integrations).',
      'Clear narrative back in chat: what changed, what’s pending, and next risks.',
    ],
    tool_chain: chain,
  };
}

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
    buildOrchestrationNote(domain, row);

  const agent_plans: MissionAgentPlan[] = resolved.map((a) => {
    const tools = [...new Set(a.tools)].filter((t) => t && t !== 'internal.sub_agent.invoke');
    const selected = buildSelectedPlan(domain, row, a.id, tools, toolDesc);

    return {
      agent_id: a.id,
      label: a.label,
      mandate: a.description,
      analyze: selected.analyze,
      transform: selected.transform,
      deliver_to: selected.deliver_to,
      tool_chain: selected.tool_chain,
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
    'Instructions: Act as orchestrator. Execute this mission: validate the row in the system of record, involve the right specialists, chain tools read-first then writes, cite what you changed, and request human approval before any high-impact or policy-gated action.',
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
