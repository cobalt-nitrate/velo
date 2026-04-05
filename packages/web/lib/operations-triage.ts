import type { HealthCheck, HealthStatus } from '@velo/tools/platform-health';

export const OPS_TRIAGE_DOMAINS = [
  'approvals',
  'compliance',
  'ap',
  'ar_open',
  'ar_overdue',
  'bank',
  'team',
  'hires',
  'hr',
] as const;

export type OpsTriageDomain = (typeof OPS_TRIAGE_DOMAINS)[number];

export function isOpsTriageDomain(d: string): d is OpsTriageDomain {
  return (OPS_TRIAGE_DOMAINS as readonly string[]).includes(d);
}

/** Approvals inbox filter — derived from specialist agent id + action_type. */
export type ApprovalModuleFilter =
  | 'all'
  | 'ap'
  | 'ar'
  | 'payroll'
  | 'hr'
  | 'compliance'
  | 'runway'
  | 'helpdesk'
  | 'other';

export function classifyApprovalModule(
  agentId: string,
  actionType: string
): ApprovalModuleFilter {
  const a = agentId.toLowerCase();
  const t = actionType.toLowerCase();
  if (a.includes('ap-invoice') || a === 'ap' || t.includes('ap_invoices'))
    return 'ap';
  if (a.includes('ar') || t.includes('ar_invoices') || t.includes('ar_')) return 'ar';
  if (a.includes('payroll')) return 'payroll';
  if (a.includes('hr')) return 'hr';
  if (a.includes('compliance')) return 'compliance';
  if (a.includes('runway')) return 'runway';
  if (a.includes('helpdesk')) return 'helpdesk';
  return 'other';
}

export const APPROVAL_MODULE_LABEL: Record<ApprovalModuleFilter, string> = {
  all: 'All',
  ap: 'AP',
  ar: 'AR',
  payroll: 'Payroll',
  hr: 'HR',
  compliance: 'Compliance',
  runway: 'Runway',
  helpdesk: 'Helpdesk',
  other: 'Other',
};

function rv(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return '';
  return String(v).trim();
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

const AGENT_CATALOG: Record<string, { label: string; one_liner: string }> = {
  orchestrator: {
    label: 'Orchestrator',
    one_liner: 'Routes work and keeps context across specialists.',
  },
  compliance: {
    label: 'Compliance',
    one_liner: 'Statutory calendar, filings, and obligation tracking.',
  },
  'ap-invoice': {
    label: 'AP & invoices',
    one_liner: 'Vendor bills, validation, and payment readiness.',
  },
  'ar-collections': {
    label: 'AR & collections',
    one_liner: 'Client receivables, follow-ups, and cash-in discipline.',
  },
  hr: {
    label: 'HR',
    one_liner: 'Onboarding tasks, people ops, and HR blockers.',
  },
  runway: {
    label: 'Runway',
    one_liner: 'Cash, burn, and ledger interpretation.',
  },
  helpdesk: {
    label: 'Helpdesk',
    one_liner: 'Employee questions and lightweight policy answers.',
  },
  payroll: {
    label: 'Payroll',
    one_liner: 'Salary cycles and statutory remittances.',
  },
};

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = { fail: 3, warn: 2, ok: 1, skipped: 0 };
  return rank[a] >= rank[b] ? a : b;
}

function foldStatuses(statuses: HealthStatus[]): HealthStatus {
  let o: HealthStatus = 'ok';
  for (const s of statuses) o = worst(o, s);
  return o;
}

export type IntegrationTriageRow = {
  id: string;
  label: string;
  status: HealthStatus;
  available: boolean;
  message: string;
  detail?: string;
  optional?: boolean;
};

/**
 * Collapse raw HealthChecks into a small set of integration rows for triage UI.
 */
export function buildIntegrationTriageRows(checks: HealthCheck[]): IntegrationTriageRow[] {
  const map = new Map(checks.map((c) => [c.id, c]));

  const pick = (id: string): HealthCheck | undefined => map.get(id);

  const workbooks = checks.filter((c) => c.id.startsWith('sheets_workbook_'));
  const google = pick('google_service_account');
  const sheetIds = pick('sheets_env_ids');
  const sheetsStack: HealthCheck[] = [];
  if (google) sheetsStack.push(google);
  if (sheetIds) sheetsStack.push(sheetIds);
  sheetsStack.push(...workbooks);
  const sheetsStatus =
    sheetsStack.length > 0 ? foldStatuses(sheetsStack.map((c) => c.status)) : ('warn' as const);
  const sheetsMessage =
    sheetsStack.length > 0
      ? sheetsStack
          .filter((c) => c.status === 'fail' || c.status === 'warn')
          .map((c) => c.message)
          .join(' · ') || 'Sheets data plane reachable'
      : 'Sheets status unknown';

  const llm = pick('llm_config');
  const approvalsQ = pick('approvals_pending');
  const resend = pick('resend');
  const drive = pick('drive_documents_root');

  const rows: IntegrationTriageRow[] = [
    {
      id: 'google_sheets',
      label: 'Google Sheets (Velo workbooks)',
      status: sheetsStatus,
      available: sheetsStatus !== 'fail',
      message: sheetsMessage,
      detail:
        workbooks.length > 0
          ? `${workbooks.filter((w) => w.status === 'ok').length}/${workbooks.length} workbooks OK`
          : undefined,
    },
    {
      id: 'llm',
      label: 'LLM (agent reasoning)',
      status: llm?.status ?? 'warn',
      available: llm?.status === 'ok',
      message: llm?.message ?? 'LLM not probed',
      detail: llm?.detail,
    },
    {
      id: 'approvals_queue',
      label: 'Approvals queue (Sheets read)',
      status: approvalsQ?.status ?? 'warn',
      available: approvalsQ?.status !== 'fail',
      message: approvalsQ?.message ?? 'Approvals queue not probed',
      detail: approvalsQ?.detail,
    },
    {
      id: 'email',
      label: 'Outbound email (Resend)',
      status: resend?.status === 'skipped' ? 'skipped' : (resend?.status ?? 'skipped'),
      available: resend?.status === 'ok',
      optional: true,
      message:
        resend?.status === 'skipped'
          ? 'Optional — not configured'
          : (resend?.message ?? 'Email not probed'),
      detail: resend?.detail,
    },
    {
      id: 'drive',
      label: 'Google Drive (document root)',
      status: drive?.status ?? 'skipped',
      available: drive?.status === 'ok' || drive?.status === 'skipped',
      optional: true,
      message: drive?.message ?? 'Drive not probed',
      detail: drive?.detail,
    },
  ];

  return rows;
}

export type TriageLlmShape = {
  /** Business stake for this specific row — entities, money, dates, risk — not product marketing. */
  business_context: string;
  what_it_means: string;
  recommended_actions: string[];
  agent_focus: { agent_id: string; why: string }[];
};

/**
 * Playbook-only: business meaning tied to the row fields (no generic “what Velo is” copy).
 */
export function rowBusinessContextPlaybook(
  domain: OpsTriageDomain,
  row: Record<string, unknown>
): string {
  switch (domain) {
    case 'approvals': {
      const id = rv(row, 'approval_id');
      const agent = rv(row, 'agent_id');
      const action = rv(row, 'action_type');
      const proposal = clip(rv(row, 'proposed_action_text'), 220);
      const conf = rv(row, 'confidence_score');
      return [
        `This is a pending approval${id ? ` (${id})` : ''} on a proposed ${action || 'operational'} change raised by ${agent || 'an agent'}.`,
        proposal ? `The request is: ${proposal}` : 'The proposed action text is what would execute if you approve.',
        `Your decision directly controls whether that change goes live in books and systems${conf ? ` (model confidence: ${conf})` : ''} — it is the financial / operational authorization point for this item.`,
      ].join(' ');
    }
    case 'compliance': {
      const label = clip(rv(row, 'label'), 100);
      const typ = rv(row, 'type');
      const pm = rv(row, 'period_month');
      const py = rv(row, 'period_year');
      const due = rv(row, 'due_date');
      const st = rv(row, 'status');
      const period =
        pm || py ? [pm, py].filter(Boolean).join('/') : '';
      return [
        `This row is a compliance obligation${label ? `: “${label}”` : ''}${typ ? ` (${typ})` : ''}.`,
        period ? `It applies to period ${period}` : 'Period fields describe which filing or deposit cycle it belongs to.',
        due ? `Due by ${due}` : 'The due date defines your filing or payment deadline.',
        `Status is “${st || 'unknown'}”. The business stake is avoiding missed statutory timelines, penalties, and last-minute scrambles that tie up finance and leadership.`,
      ].join(' ');
    }
    case 'ap': {
      const vendor = clip(rv(row, 'vendor_name'), 80);
      const inv = rv(row, 'invoice_number');
      const amt = rv(row, 'total_amount');
      const due = rv(row, 'due_date');
      const ps = rv(row, 'payment_status');
      return [
        `This is an open payable${vendor ? ` to ${vendor}` : ''}${inv ? ` on invoice ${inv}` : ''}.`,
        amt ? `The booked amount is ${amt} INR (as shown).` : 'Amount on the row drives cash-out and working capital.',
        due ? `It is due ${due}` : 'Due date drives payment scheduling and vendor relationships.',
        `Payment status: ${ps || 'unspecified'}. Paying on time protects supplier terms and input-credit discipline; delaying affects cash forecasts and may strain vendor trust.`,
      ].join(' ');
    }
    case 'ar_open': {
      const client = clip(rv(row, 'client_name'), 80);
      const inv = rv(row, 'invoice_number');
      const amt = rv(row, 'total_amount');
      const due = rv(row, 'due_date');
      const fu = rv(row, 'followup_count');
      const st = rv(row, 'status');
      return [
        `This is billed revenue still outstanding${client ? ` from ${client}` : ''}${inv ? ` (invoice ${inv})` : ''}.`,
        amt ? `Amount: ${amt} INR.` : '',
        due ? `Due ${due}` : '',
        `Status: ${st || '—'}${fu ? `; ${fu} follow-up(s) logged` : ''}.`,
        'Until collected, it is cash you are owed but cannot deploy — it affects runway, DSO, and how hard your team must work collections.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'ar_overdue': {
      const client = clip(rv(row, 'client_name'), 80);
      const inv = rv(row, 'invoice_number');
      const amt = rv(row, 'total_amount');
      const due = rv(row, 'due_date');
      const st = rv(row, 'status');
      return [
        `This receivable is overdue${client ? ` for ${client}` : ''}${inv ? ` (${inv})` : ''}.`,
        amt ? `Amount: ${amt} INR.` : '',
        due ? `Original due date ${due}.` : '',
        `Status: ${st || '—'}.`,
        'Overdue AR directly pressures working capital and often flags client, delivery, or dispute risk — recovering or restructuring it is a priority business decision.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'bank': {
      const date = rv(row, 'date');
      const narr = clip(rv(row, 'narration'), 160);
      const amt = rv(row, 'amount');
      const bal = rv(row, 'balance');
      const typ = rv(row, 'type');
      return [
        `This ledger line is dated ${date || '—'}${typ ? ` and typed as ${typ}` : ''}.`,
        narr ? `Narration: ${narr}` : '',
        amt || bal ? [amt ? `Amount ${amt} INR` : '', bal ? `running balance ${bal} INR` : ''].filter(Boolean).join('; ') + '.' : '',
        'In business terms it is evidence of actual cash movement — used to reconcile books, validate payouts, and explain changes in your bank position vs. what operations expect.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'team': {
      const name = clip(rv(row, 'full_name'), 80);
      const dept = rv(row, 'department');
      const des = rv(row, 'designation');
      const doj = rv(row, 'doj');
      const st = rv(row, 'status');
      return [
        `This roster entry is for ${name || 'an employee'}${des ? `, ${des}` : ''}${dept ? ` in ${dept}` : ''}.`,
        doj ? `Date of join: ${doj}.` : '',
        `Employment status: ${st || '—'}.`,
        'Accurate roster data feeds payroll cost, headcount planning, access provisioning, and statutory employee reporting — errors here propagate into pay slips, compliance, and org charts.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'hires': {
      const desc = clip(rv(row, 'description'), 200);
      const tt = rv(row, 'task_type');
      const eid = rv(row, 'employee_id');
      const due = rv(row, 'due_date');
      const st = rv(row, 'status');
      return [
        `This is an open hire/onboarding task (${tt || 'type not specified'})${eid ? ` linked to employee ${eid}` : ''}.`,
        desc ? `Work described: ${desc}` : '',
        due ? `Due ${due}` : '',
        `Status: ${st || '—'}.`,
        'Each open task delays that person’s productivity, compliance readiness, or access to systems — the business stake is time-to-value and people-risk for new joiners.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'hr': {
      const desc = clip(rv(row, 'description'), 200);
      const tt = rv(row, 'task_type');
      const eid = rv(row, 'employee_id');
      const due = rv(row, 'due_date');
      const st = rv(row, 'status');
      return [
        `This HR item is a blocker (${tt || 'unspecified type'})${eid ? ` for ${eid}` : ''}.`,
        desc ? `Details: ${desc}` : '',
        due ? `Due ${due}` : '',
        `Status: ${st || '—'}.`,
        'Unresolved people-ops blockers can delay payroll runs, statutory submissions, or critical employee requests — the business stake is continuity and employee trust.',
      ]
        .filter(Boolean)
        .join(' ');
    }
    default:
      return `This operational row concerns: ${clip(JSON.stringify(row), 400)}. Interpret the fields above in terms of cash, compliance, or people impact for your company.`;
  }
}

export type OperationsTriageResponse = {
  ok: true;
  domain: OpsTriageDomain;
  triage: TriageLlmShape;
  integrations: IntegrationTriageRow[];
  agents_resolved: { agent_id: string; label: string; why: string }[];
  llm_generated: boolean;
  health_generated_at: string;
};

export function playbookFallback(
  domain: OpsTriageDomain,
  row: Record<string, unknown>
): TriageLlmShape {
  const agentsFor = (ids: string[]): { agent_id: string; why: string }[] =>
    ids.map((id) => ({
      agent_id: id,
      why: AGENT_CATALOG[id]?.one_liner ?? 'Specialist agent for this workstream.',
    }));

  const bc = rowBusinessContextPlaybook(domain, row);
  const rowBrief = JSON.stringify(row).slice(0, 600);

  switch (domain) {
    case 'approvals': {
      const aid = String(row.agent_id ?? 'orchestrator');
      const agentIds = [...new Set(['orchestrator', aid].filter(Boolean))];
      return {
        business_context: bc,
        what_it_means:
          'This row is a gated action proposed by an agent. It is waiting for a human decision before Velo can execute anything in Sheets or downstream tools.',
        recommended_actions: [
          'Read the proposed action and evidence; confirm it matches policy.',
          'Approve or reject in Velo; add resolution notes for audit.',
          'If unsure, open chat with the same agent id to clarify before deciding.',
        ],
        agent_focus: agentsFor(agentIds),
      };
    }
    case 'compliance':
      return {
        business_context: bc,
        what_it_means:
          'This is a statutory obligation row (filing, payment, or compliance milestone). The due window and status describe timing risk for your entity.',
        recommended_actions: [
          'Confirm the period and form type against your compliance calendar.',
          'Assign an owner; gather inputs (ledgers, challans) before the due date.',
          'Mark done in Sheets when filed / paid so attention items clear.',
        ],
        agent_focus: agentsFor(['compliance', 'orchestrator']),
      };
    case 'ap':
      return {
        business_context: bc,
        what_it_means:
          'An open vendor payable: money is owed to a supplier against this invoice. Age and amount drive cash planning and GST input credit timing.',
        recommended_actions: [
          'Three-way match (PO / GRN if applicable) and approve for payment.',
          'Verify bank beneficiary and GST before scheduling payout.',
          'Update payment_status in Sheets when paid.',
        ],
        agent_focus: agentsFor(['ap-invoice', 'orchestrator']),
      };
    case 'ar_open':
      return {
        business_context: bc,
        what_it_means:
          'An open client receivable: revenue billed but cash not yet received. Follow-up count signals how hard collections have been worked.',
        recommended_actions: [
          'Send or escalate a polite collections touchpoint with invoice reference.',
          'Confirm delivery / acceptance if payment is disputed.',
          'Log outcome so AR aging stays truthful.',
        ],
        agent_focus: agentsFor(['ar-collections', 'orchestrator']),
      };
    case 'ar_overdue':
      return {
        business_context: bc,
        what_it_means:
          'This receivable is past its due date — cash and working capital are at risk until collected or formally renegotiated.',
        recommended_actions: [
          'Priority outreach with a clear ask and deadline.',
          'Involve finance lead if amount or client risk is material.',
          'Document payment plans or disputes in your source of truth.',
        ],
        agent_focus: agentsFor(['ar-collections', 'orchestrator']),
      };
    case 'bank':
      return {
        business_context: bc,
        what_it_means:
          'A bank ledger line from your imported statement — useful for reconciliation, runway, and spotting anomalies.',
        recommended_actions: [
          'Match narration to invoices, payroll, or internal transfers.',
          'Flag unexplained debits for review.',
          'Keep statement import cadence so cash view stays current.',
        ],
        agent_focus: agentsFor(['runway', 'orchestrator']),
      };
    case 'team':
      return {
        business_context: bc,
        what_it_means:
          'An active employee roster row — demographic facts for headcount, org planning, and lightweight HR queries.',
        recommended_actions: [
          'Keep status and department current for downstream payroll and seating.',
          'Use HR chat for policy questions tied to this person.',
        ],
        agent_focus: agentsFor(['hr', 'helpdesk', 'orchestrator']),
      };
    case 'hires':
      return {
        business_context: bc,
        what_it_means:
          'An open onboarding / hire-related task — paperwork, access, or induction steps before someone is fully productive.',
        recommended_actions: [
          'Close blockers in order — offer → documents → accounts.',
          'Set a single owner per task; chase dependencies.',
        ],
        agent_focus: agentsFor(['hr', 'orchestrator']),
      };
    case 'hr':
      return {
        business_context: bc,
        what_it_means:
          'An HR blocker task — something in people ops is stuck and may affect payroll cycles, compliance, or employee experience.',
        recommended_actions: [
          'Triage by due date and statutory impact first.',
          'Escalate to functional owner with a concrete ask.',
        ],
        agent_focus: agentsFor(['hr', 'orchestrator']),
      };
    default:
      return {
        business_context: bc,
        what_it_means: `Operational row: ${rowBrief}`,
        recommended_actions: ['Review details in Velo chat with the relevant specialist agent.'],
        agent_focus: agentsFor(['orchestrator']),
      };
  }
}

export function agentLabel(agentId: string): string {
  return AGENT_CATALOG[agentId]?.label ?? agentId;
}
