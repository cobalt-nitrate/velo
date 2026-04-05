// Non-destructive probes for Velo platform integrations (Sheets, Drive, LLM, auth env).
// Used by GET /api/health and the internal.platform.healthcheck agent tool.

import { google } from 'googleapis';
import { executeSheetTool, listPendingApprovals } from './sheets/client.js';

export type HealthStatus = 'ok' | 'warn' | 'fail' | 'skipped';

export interface HealthCheck {
  id: string;
  status: HealthStatus;
  message: string;
  detail?: string;
  ms?: number;
}

/** What is in Velo Sheets / pending work — not just “can we ping Google”. */
export interface PendingApprovalDetail {
  approval_id: string;
  action_type: string;
  agent_id: string;
  proposed_action_text: string;
  confidence_score: string;
  created_at: string;
}

/** Open vendor bills — safe fields for UI + LLM (no PAN/bank). */
export interface ApPayableSummary {
  invoice_id: string;
  vendor_id: string;
  vendor_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  payment_status: string;
  /** Negative = overdue (calendar days, UTC midnight). */
  days_until_due: number | null;
}

export interface ArReceivableSummary {
  invoice_id: string;
  client_id: string;
  client_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  status: string;
  followup_count: string;
  days_until_due: number | null;
}

export interface HrTaskSummary {
  task_id: string;
  employee_id: string;
  task_type: string;
  description: string;
  due_date: string;
  status: string;
}

/** Upcoming statutory / filing rows (no sensitive IDs beyond calendar_id). */
export interface ComplianceObligationSummary {
  calendar_id: string;
  type: string;
  label: string;
  period_month: string;
  period_year: string;
  due_date: string;
  status: string;
  /** Negative = overdue relative to today (should not happen for upcoming filter). */
  days_until_due: number | null;
}

/** Active roster — safe fields only (no PAN, Aadhaar, bank). */
export interface ActiveEmployeeSummary {
  employee_id: string;
  full_name: string;
  email: string;
  designation: string;
  department: string;
  doj: string;
  status: string;
  employment_type: string;
}

export interface BankTransactionSummary {
  txn_id: string;
  date: string;
  narration: string;
  amount: string;
  balance: string;
  type: string;
  mode: string;
}

export interface OperationalSnapshot {
  data_source: 'sheets' | 'unavailable';
  /** Rows the user may need to approve / review */
  pending_approvals: PendingApprovalDetail[];
  /** compliance_calendar obligations due in window, not marked done */
  compliance_upcoming: ComplianceObligationSummary[];
  open_ap_payables: number;
  open_ar_receivables: number;
  ar_overdue: number;
  bank_txn_count: number;
  bank_balance_inr: number | null;
  bank_as_of_date: string | null;
  active_employees: number | null;
  hr_open_blockers: number;
  /** Onboarding / open hire-related tasks (get_pending_hires filter). */
  hr_pending_hires: number;
  /**
   * Line-level open AP (same filter as get_pending_payables), capped for LLM context.
   * When user asks “what are these payables?”, cite this — do not say details are unavailable.
   */
  ap_payables_detail: ApPayableSummary[];
  ar_receivables_detail: ArReceivableSummary[];
  ar_overdue_detail: ArReceivableSummary[];
  hr_blockers_detail: HrTaskSummary[];
  hr_pending_hires_detail: HrTaskSummary[];
  /** Recent bank ledger lines (newest first), capped. */
  bank_transactions_detail: BankTransactionSummary[];
  /** Active employees (same source as headcount), capped; safe columns only. */
  employees_detail: ActiveEmployeeSummary[];
  /** Copy-ready bullets: approvals, overdue, filings, gaps */
  attention_items: string[];
  /** Non-fatal read errors (tab missing, etc.) */
  probe_errors?: string[];
}

export interface PlatformHealthReport {
  generated_at: string;
  overall: HealthStatus;
  checks: HealthCheck[];
  /** Short line for LLM to quote */
  summary: string;
  /** Live data + “what needs you” — populated when Sheets is configured */
  operational_snapshot?: OperationalSnapshot;
}

const SHEET_ENV_KEYS = [
  ['SHEETS_CONFIG_ID', 'CONFIG'],
  ['SHEETS_MASTER_ID', 'MASTER'],
  ['SHEETS_TRANSACTIONS_ID', 'TRANSACTIONS'],
  ['SHEETS_COMPLIANCE_ID', 'COMPLIANCE'],
  ['SHEETS_LOGS_ID', 'LOGS'],
] as const;

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = {
    fail: 3,
    warn: 2,
    ok: 1,
    skipped: 0,
  };
  return rank[a] >= rank[b] ? a : b;
}

function foldOverall(checks: HealthCheck[]): HealthStatus {
  let o: HealthStatus = 'ok';
  for (const c of checks) o = worst(o, c.status);
  return o;
}

function trunc(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

const MAX_DETAIL_ROWS = 50;

/** Midnight-normalized delta: negative means overdue. */
export function daysUntilDue(dueDateStr: string): number | null {
  const d = new Date(String(dueDateStr ?? '').slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  d.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function mapApPayableRow(r: Record<string, string>): ApPayableSummary {
  const due = String(r.due_date ?? '');
  return {
    invoice_id: String(r.invoice_id ?? ''),
    vendor_id: String(r.vendor_id ?? ''),
    vendor_name: trunc(String(r.vendor_name ?? ''), 120),
    invoice_number: String(r.invoice_number ?? ''),
    invoice_date: String(r.invoice_date ?? ''),
    due_date: due,
    total_amount: String(r.total_amount ?? r.subtotal ?? ''),
    payment_status: String(r.payment_status ?? ''),
    days_until_due: daysUntilDue(due),
  };
}

function mapArReceivableRow(r: Record<string, string>): ArReceivableSummary {
  const due = String(r.due_date ?? '');
  return {
    invoice_id: String(r.invoice_id ?? ''),
    client_id: String(r.client_id ?? ''),
    client_name: trunc(String(r.client_name ?? ''), 120),
    invoice_number: String(r.invoice_number ?? ''),
    invoice_date: String(r.invoice_date ?? ''),
    due_date: due,
    total_amount: String(r.total_amount ?? ''),
    status: String(r.status ?? ''),
    followup_count: String(r.followup_count ?? ''),
    days_until_due: daysUntilDue(due),
  };
}

function mapHrBlockerRow(r: Record<string, string>): HrTaskSummary {
  return {
    task_id: String(r.task_id ?? ''),
    employee_id: String(r.employee_id ?? ''),
    task_type: String(r.task_type ?? ''),
    description: trunc(String(r.description ?? ''), 200),
    due_date: String(r.due_date ?? ''),
    status: String(r.status ?? ''),
  };
}

function mapComplianceRow(r: Record<string, string>): ComplianceObligationSummary {
  const due = String(r.due_date ?? '');
  return {
    calendar_id: String(r.calendar_id ?? ''),
    type: String(r.type ?? ''),
    label: trunc(String(r.label ?? ''), 160),
    period_month: String(r.period_month ?? ''),
    period_year: String(r.period_year ?? ''),
    due_date: due,
    status: String(r.status ?? ''),
    days_until_due: daysUntilDue(due),
  };
}

function mapEmployeeRow(r: Record<string, string>): ActiveEmployeeSummary {
  return {
    employee_id: String(r.employee_id ?? ''),
    full_name: trunc(String(r.full_name ?? ''), 120),
    email: trunc(String(r.email ?? ''), 120),
    designation: trunc(String(r.designation ?? ''), 80),
    department: trunc(String(r.department ?? ''), 80),
    doj: String(r.doj ?? ''),
    status: String(r.status ?? ''),
    employment_type: String(r.employment_type ?? ''),
  };
}

function mapBankTxnRow(r: Record<string, string>): BankTransactionSummary {
  return {
    txn_id: String(r.txn_id ?? ''),
    date: String(r.date ?? ''),
    narration: trunc(String(r.narration ?? ''), 200),
    amount: String(r.amount ?? ''),
    balance: String(r.balance ?? ''),
    type: String(r.type ?? ''),
    mode: String(r.mode ?? ''),
  };
}

/** Sheet reads for “business health” — empty company_id avoids over-filtering bank rows in demos. */
const HEALTH_READ_COMPANY = '';

async function safeSheetRead(
  tool_id: string,
  extra: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  try {
    return await executeSheetTool({
      tool_id,
      company_id: HEALTH_READ_COMPANY,
      ...extra,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function gatherOperationalSnapshot(): Promise<OperationalSnapshot> {
  const probe_errors: string[] = [];
  const attention_items: string[] = [];

  const emptyDetail = (): Pick<
    OperationalSnapshot,
    | 'ap_payables_detail'
    | 'ar_receivables_detail'
    | 'ar_overdue_detail'
    | 'hr_blockers_detail'
    | 'hr_pending_hires_detail'
    | 'bank_transactions_detail'
    | 'employees_detail'
  > => ({
    ap_payables_detail: [],
    ar_receivables_detail: [],
    ar_overdue_detail: [],
    hr_blockers_detail: [],
    hr_pending_hires_detail: [],
    bank_transactions_detail: [],
    employees_detail: [],
  });

  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    !process.env.GOOGLE_PRIVATE_KEY?.trim() ||
    !process.env.SHEETS_TRANSACTIONS_ID?.trim()
  ) {
    return {
      data_source: 'unavailable',
      pending_approvals: [],
      compliance_upcoming: [],
      open_ap_payables: 0,
      open_ar_receivables: 0,
      ar_overdue: 0,
      bank_txn_count: 0,
      bank_balance_inr: null,
      bank_as_of_date: null,
      active_employees: null,
      hr_open_blockers: 0,
      hr_pending_hires: 0,
      attention_items: [
        'Operational snapshot skipped: Google Sheets env not fully configured (service account or SHEETS_*_ID).',
      ],
      ...emptyDetail(),
    };
  }

  const pendingRaw = await listPendingApprovals(30);
  const pending_approvals: PendingApprovalDetail[] = pendingRaw.map((r) => ({
    approval_id: String(r.approval_id ?? r.id ?? ''),
    action_type: String(r.action_type ?? ''),
    agent_id: String(r.agent_id ?? ''),
    proposed_action_text: trunc(String(r.proposed_action_text ?? ''), 320),
    confidence_score: String(r.confidence_score ?? ''),
    created_at: String(r.created_at ?? ''),
  })).filter((p) => p.approval_id.length > 0);

  if (pending_approvals.length > 0) {
    attention_items.push(
      `${pending_approvals.length} open approval(s) need a human decision in Velo (see pending_approvals for IDs and proposed actions).`
    );
  }

  let compliance_upcoming: ComplianceObligationSummary[] = [];
  const comp = await safeSheetRead('sheets.compliance_calendar.get_upcoming_obligations', {
    days_ahead: 60,
  });
  if (comp && comp.ok === false) {
    probe_errors.push(`compliance_calendar: ${String(comp.error ?? 'read failed')}`);
  } else if (comp?.rows && Array.isArray(comp.rows)) {
    compliance_upcoming = (comp.rows as Record<string, string>[])
      .slice(0, MAX_DETAIL_ROWS)
      .map(mapComplianceRow);
    if (compliance_upcoming.length > 0) {
      attention_items.push(
        `${compliance_upcoming.length} compliance obligation(s) due in the next ~60 days (not marked done in calendar).`
      );
    }
  }

  let open_ap_payables = 0;
  let ap_payables_detail: ApPayableSummary[] = [];
  const ap = await safeSheetRead('sheets.ap_invoices.get_pending_payables');
  if (ap && ap.ok === false) probe_errors.push(`ap_payables: ${String(ap.error ?? '')}`);
  else if (typeof ap?.count === 'number') {
    open_ap_payables = ap.count;
    if (Array.isArray(ap.rows)) {
      ap_payables_detail = (ap.rows as Record<string, string>[])
        .slice(0, MAX_DETAIL_ROWS)
        .map(mapApPayableRow);
    }
    if (open_ap_payables > 0) {
      attention_items.push(`${open_ap_payables} AP invoice row(s) still unpaid / open (get_pending_payables).`);
    }
  }

  let open_ar_receivables = 0;
  let ar_receivables_detail: ArReceivableSummary[] = [];
  const arP = await safeSheetRead('sheets.ar_invoices.get_pending_receivables');
  if (arP && arP.ok === false) probe_errors.push(`ar_open: ${String(arP.error ?? '')}`);
  else if (typeof arP?.count === 'number') {
    open_ar_receivables = arP.count;
    if (Array.isArray(arP.rows)) {
      ar_receivables_detail = (arP.rows as Record<string, string>[])
        .slice(0, MAX_DETAIL_ROWS)
        .map(mapArReceivableRow);
    }
  }

  let ar_overdue = 0;
  let ar_overdue_detail: ArReceivableSummary[] = [];
  const arO = await safeSheetRead('sheets.ar_invoices.get_overdue');
  if (arO && arO.ok === false) probe_errors.push(`ar_overdue: ${String(arO.error ?? '')}`);
  else if (typeof arO?.count === 'number') {
    ar_overdue = arO.count;
    if (Array.isArray(arO.rows)) {
      ar_overdue_detail = (arO.rows as Record<string, string>[])
        .slice(0, MAX_DETAIL_ROWS)
        .map(mapArReceivableRow);
    }
    if (ar_overdue > 0) {
      attention_items.push(`${ar_overdue} AR invoice(s) are overdue — collections attention likely needed.`);
    }
  }

  let bank_txn_count = 0;
  let bank_balance_inr: number | null = null;
  let bank_as_of_date: string | null = null;
  let bank_transactions_detail: BankTransactionSummary[] = [];
  const bank = await safeSheetRead('sheets.bank_transactions.get_latest_balance');
  if (bank.ok === false) probe_errors.push(`bank: ${String(bank.error ?? '')}`);
  else if (bank.ok !== false) {
    bank_txn_count = typeof bank.transaction_count === 'number' ? bank.transaction_count : 0;
    bank_balance_inr = typeof bank.balance_inr === 'number' ? bank.balance_inr : null;
    bank_as_of_date = bank.as_of_date != null ? String(bank.as_of_date) : null;
    if (bank_txn_count === 0) {
      attention_items.push('No bank_transactions rows match this workspace — cash position may be unknown until imports run.');
    }
  }

  const bankRecent = await safeSheetRead('sheets.bank_transactions.get_recent', {
    limit: MAX_DETAIL_ROWS,
  });
  if (bankRecent && bankRecent.ok === false) {
    probe_errors.push(`bank_recent: ${String(bankRecent.error ?? '')}`);
  } else if (Array.isArray(bankRecent?.rows)) {
    bank_transactions_detail = (bankRecent.rows as Record<string, string>[]).map(mapBankTxnRow);
  }

  let active_employees: number | null = null;
  let employees_detail: ActiveEmployeeSummary[] = [];
  const emp = await safeSheetRead('sheets.employees.get_active_headcount');
  if (emp && emp.ok === false) probe_errors.push(`employees: ${String(emp.error ?? '')}`);
  else if (typeof emp?.headcount === 'number') {
    active_employees = emp.headcount;
    if (Array.isArray(emp.rows)) {
      employees_detail = (emp.rows as Record<string, string>[])
        .slice(0, MAX_DETAIL_ROWS)
        .map(mapEmployeeRow);
    }
  }

  let hr_open_blockers = 0;
  let hr_blockers_detail: HrTaskSummary[] = [];
  const hr = await safeSheetRead('sheets.hr_tasks.get_blockers');
  if (hr && hr.ok === false) probe_errors.push(`hr_tasks: ${String(hr.error ?? '')}`);
  else if (typeof hr?.count === 'number') {
    hr_open_blockers = hr.count;
    if (Array.isArray(hr.rows)) {
      hr_blockers_detail = (hr.rows as Record<string, string>[])
        .slice(0, MAX_DETAIL_ROWS)
        .map(mapHrBlockerRow);
    }
    if (hr_open_blockers > 0) {
      attention_items.push(`${hr_open_blockers} HR task(s) in blocked/pending/open state — review hr_tasks.`);
    }
  }

  let hr_pending_hires = 0;
  let hr_pending_hires_detail: HrTaskSummary[] = [];
  const hrHires = await safeSheetRead('sheets.hr_tasks.get_pending_hires');
  if (hrHires && hrHires.ok === false) {
    probe_errors.push(`hr_pending_hires: ${String(hrHires.error ?? '')}`);
  } else if (typeof hrHires?.count === 'number') {
    hr_pending_hires = hrHires.count;
    if (Array.isArray(hrHires.rows)) {
      hr_pending_hires_detail = (hrHires.rows as Record<string, string>[])
        .slice(0, MAX_DETAIL_ROWS)
        .map(mapHrBlockerRow);
    }
    if (hr_pending_hires > 0) {
      attention_items.push(`${hr_pending_hires} HR onboarding / hire task(s) still open — see hr_pending_hires_detail.`);
    }
  }

  if (attention_items.length === 0) {
    attention_items.push(
      'No urgent operational flags from sampled Sheets data — still review pending_approvals and compliance_upcoming regularly.'
    );
  }

  return {
    data_source: 'sheets',
    pending_approvals,
    compliance_upcoming,
    open_ap_payables,
    open_ar_receivables,
    ar_overdue,
    bank_txn_count,
    bank_balance_inr,
    bank_as_of_date,
    active_employees,
    hr_open_blockers,
    hr_pending_hires,
    ap_payables_detail,
    ar_receivables_detail,
    ar_overdue_detail,
    hr_blockers_detail,
    hr_pending_hires_detail,
    bank_transactions_detail,
    employees_detail,
    attention_items,
    probe_errors: probe_errors.length ? probe_errors : undefined,
  };
}

async function getGoogleClients() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !rawKey) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: rawKey },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
  const client = await auth.getClient();
  const authParam = client as Parameters<typeof google.sheets>[0]['auth'];
  return {
    sheets: google.sheets({ version: 'v4', auth: authParam }),
    drive: google.drive({ version: 'v3', auth: authParam }),
  };
}

async function probeSpreadsheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  label: string
): Promise<HealthCheck> {
  const t0 = Date.now();
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,spreadsheetId',
    });
    const title = res.data.properties?.title ?? '(no title)';
    return {
      id: `sheets_workbook_${label}`,
      status: 'ok',
      message: `Workbook reachable: ${title}`,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      id: `sheets_workbook_${label}`,
      status: 'fail',
      message: `Cannot access ${label} spreadsheet`,
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - t0,
    };
  }
}

async function probeDriveFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string
): Promise<HealthCheck> {
  const t0 = Date.now();
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType',
    });
    return {
      id: 'drive_documents_root',
      status: 'ok',
      message: `Drive folder OK: ${res.data.name ?? folderId}`,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      id: 'drive_documents_root',
      status: 'fail',
      message: 'VELO_DRIVE_FOLDER_ID not reachable with service account',
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - t0,
    };
  }
}

/**
 * Integration / config probes only — no full operational snapshot (faster for triage UI, etc.).
 */
export async function runIntegrationHealthQuick(): Promise<{
  generated_at: string;
  overall: HealthStatus;
  checks: HealthCheck[];
  summary: string;
}> {
  const checks = await buildIntegrationChecks();
  const overall = foldOverall(checks);
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const summary =
    overall === 'ok'
      ? `All critical checks passed (${checks.length} integration probes).`
      : overall === 'warn'
        ? `Health: warnings (${warnCount}) — see checks.`
        : `Health: ${failCount} failed, ${warnCount} warning(s) — see checks.`;
  return {
    generated_at: new Date().toISOString(),
    overall,
    checks,
    summary,
  };
}

async function buildIntegrationChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // —— Google service account ——
  const gEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const gKey = process.env.GOOGLE_PRIVATE_KEY;
  if (gEmail && gKey) {
    checks.push({
      id: 'google_service_account',
      status: 'ok',
      message: 'GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set',
    });
  } else {
    checks.push({
      id: 'google_service_account',
      status: 'fail',
      message: 'Google service account env missing',
      detail: !gEmail ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL unset' : 'GOOGLE_PRIVATE_KEY unset',
    });
  }

  // —— LLM ——
  const llmKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  const llmBase =
    process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
  if (llmKey?.trim()) {
    checks.push({
      id: 'llm_config',
      status: 'ok',
      message: 'LLM API key configured',
      detail: `Base URL: ${llmBase}`,
    });
  } else {
    checks.push({
      id: 'llm_config',
      status: 'fail',
      message: 'LLM_API_KEY / OPENAI_API_KEY missing — agents cannot run',
    });
  }

  // —— Sheet IDs ——
  const missingIds = SHEET_ENV_KEYS.filter(([k]) => !process.env[k]?.trim()).map(
    ([k, lab]) => `${k} (${lab})`
  );
  if (missingIds.length === 0) {
    checks.push({
      id: 'sheets_env_ids',
      status: 'ok',
      message: 'All SHEETS_*_ID variables are set',
    });
  } else {
    checks.push({
      id: 'sheets_env_ids',
      status: 'fail',
      message: 'Some spreadsheet env IDs are missing',
      detail: missingIds.join(', '),
    });
  }

  // —— Per-workbook reachability (only if credentials + that id exist) ——
  let clients: Awaited<ReturnType<typeof getGoogleClients>> = null;
  if (gEmail && gKey) {
    try {
      clients = await getGoogleClients();
    } catch (e) {
      checks.push({
        id: 'google_auth',
        status: 'fail',
        message: 'Failed to build Google Auth client',
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (clients) {
    for (const [envKey, label] of SHEET_ENV_KEYS) {
      const id = process.env[envKey]?.trim();
      if (id) {
        checks.push(await probeSpreadsheet(clients.sheets, id, label));
      }
    }

    const driveFolder = process.env.VELO_DRIVE_FOLDER_ID?.trim();
    if (driveFolder) {
      checks.push(await probeDriveFolder(clients.drive, driveFolder));
    } else {
      checks.push({
        id: 'drive_documents_root',
        status: 'skipped',
        message: 'VELO_DRIVE_FOLDER_ID not set — Drive document uploads optional',
      });
    }
  } else if (missingIds.length === 0 && gEmail && gKey) {
    checks.push({
      id: 'google_auth',
      status: 'warn',
      message: 'Could not initialize Google client for workbook probes',
    });
  }

  // —— NextAuth (production hint) ——
  const secret = process.env.NEXTAUTH_SECRET;
  const url = process.env.NEXTAUTH_URL;
  if (process.env.NODE_ENV === 'production') {
    if (secret?.trim() && url?.trim()) {
      checks.push({ id: 'nextauth', status: 'ok', message: 'NEXTAUTH_SECRET and NEXTAUTH_URL set' });
    } else {
      checks.push({
        id: 'nextauth',
        status: 'warn',
        message: 'Production: review NextAuth env',
        detail: [!secret && 'NEXTAUTH_SECRET missing', !url && 'NEXTAUTH_URL missing']
          .filter(Boolean)
          .join('; '),
      });
    }
  } else {
    checks.push({
      id: 'nextauth',
      status: 'skipped',
      message: 'NEXTAUTH not required for health in non-production',
    });
  }

  // —— Email / Slack optional ——
  checks.push({
    id: 'resend',
    status: process.env.RESEND_API_KEY?.trim() ? 'ok' : 'skipped',
    message: process.env.RESEND_API_KEY?.trim()
      ? 'RESEND_API_KEY set'
      : 'RESEND_API_KEY unset — outbound email tools unavailable',
  });

  // —— Data plane: pending approvals ——
  const tApproval = Date.now();
  try {
    const pending = await listPendingApprovals(50);
    checks.push({
      id: 'approvals_pending',
      status: 'ok',
      message: `${pending.length} pending approval(s) in queue`,
      ms: Date.now() - tApproval,
    });
  } catch (e) {
    checks.push({
      id: 'approvals_pending',
      status: 'warn',
      message: 'Could not read pending approvals',
      detail: e instanceof Error ? e.message : String(e),
      ms: Date.now() - tApproval,
    });
  }

  return checks;
}

/**
 * Run all probes. Safe to call from server routes and agent tools (read-only).
 */
export async function runPlatformHealthcheck(): Promise<PlatformHealthReport> {
  const now = new Date().toISOString();
  const checks = await buildIntegrationChecks();

  const overall = foldOverall(checks);
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  let summary =
    overall === 'ok'
      ? `All critical checks passed (${checks.length} integration probes).`
      : overall === 'warn'
        ? `Health: warnings (${warnCount}) — see checks.`
        : `Health: ${failCount} failed, ${warnCount} warning(s) — see checks.`;

  let operational_snapshot: OperationalSnapshot | undefined;
  try {
    operational_snapshot = await gatherOperationalSnapshot();
    if (operational_snapshot.data_source === 'sheets') {
      const bits = operational_snapshot.attention_items.slice(0, 4);
      summary += ` Data ops: ${bits.join(' ')}`;
    }
  } catch (e) {
    operational_snapshot = {
      data_source: 'unavailable',
      pending_approvals: [],
      compliance_upcoming: [],
      open_ap_payables: 0,
      open_ar_receivables: 0,
      ar_overdue: 0,
      bank_txn_count: 0,
      bank_balance_inr: null,
      bank_as_of_date: null,
      active_employees: null,
      hr_open_blockers: 0,
      hr_pending_hires: 0,
      ap_payables_detail: [],
      ar_receivables_detail: [],
      ar_overdue_detail: [],
      hr_blockers_detail: [],
      hr_pending_hires_detail: [],
      bank_transactions_detail: [],
      employees_detail: [],
      attention_items: [
        `Could not build operational snapshot: ${e instanceof Error ? e.message : String(e)}`,
      ],
    };
  }

  return {
    generated_at: now,
    overall,
    checks,
    summary,
    operational_snapshot,
  };
}
