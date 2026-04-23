// Velo data client — all business data is stored in PostgreSQL.
// In-memory fallback exists only for local dev when DATABASE_URL is unset (disabled in production).

import { canonicalVeloDataToolId } from '@velo/core';
import { prisma } from './prisma.js';
import { isApprovalPendingStatus } from './approval-status.js';
import {
  APPROVAL_FILE_LINK_SCOPE,
  mergeFileLinkRowsIntoApprovalAttachmentsJson,
  parseAttachmentDriveUrlsJson,
} from './approval-attachments.js';

export {
  APPROVAL_FILE_LINK_SCOPE,
  parseAttachmentDriveUrlsJson,
  type DriveAttachmentRef,
} from './approval-attachments.js';
export {
  isApprovalApprovedStatus,
  isApprovalPendingStatus,
} from './approval-status.js';

// ─── Table → Prisma model name ────────────────────────────────────────────────

const TABLE_TO_MODEL: Record<string, string> = {
  // Config
  company_settings: 'companySetting',
  tax_rates: 'taxRate',
  expense_categories: 'expenseCategory',
  payroll_components: 'payrollComponent',
  leave_types: 'leaveType',
  compliance_rules: 'complianceRule',
  // Master
  employees: 'employee',
  salary_structures: 'salaryStructure',
  vendor_master: 'vendor',
  client_master: 'client',
  bank_payees: 'bankPayee',
  // Transactions
  bank_transactions: 'bankTransaction',
  ap_invoices: 'apInvoice',
  ar_invoices: 'arInvoice',
  payroll_runs: 'payrollRun',
  salary_slips: 'salarySlip',
  leave_records: 'leaveRecord',
  leave_balances: 'leaveBalance',
  attendance: 'attendance',
  approval_requests: 'approvalRequest',
  hr_tasks: 'hrTask',
  expense_entries: 'expenseEntry',
  // Compliance
  gst_input_ledger: 'gstInputLedger',
  gst_output_ledger: 'gstOutputLedger',
  compliance_calendar: 'complianceCalendar',
  tax_obligations: 'taxObligation',
  tds_records: 'tdsRecord',
  filing_history: 'filingHistory',
  // Logs
  audit_trail: 'auditTrailEntry',
  chat_log: 'chatLog',
  agent_run_log: 'agentRunLog',
  policy_decisions: 'policyDecision',
  policy_documents: 'policyDocument',
  notification_log: 'notificationLog',
  file_links: 'fileLink',
};

// The camelCase Prisma field name that holds the business-domain unique key
// (separate from the internal cuid `id`).
const TABLE_UNIQUE_FIELD: Record<string, string> = {
  company_settings: 'key',
  expense_categories: 'categoryId',
  payroll_components: 'componentId',
  leave_types: 'leaveTypeId',
  compliance_rules: 'ruleId',
  employees: 'employeeId',
  salary_structures: 'structureId',
  vendor_master: 'vendorId',
  client_master: 'clientId',
  bank_payees: 'payeeId',
  bank_transactions: 'txnId',
  ap_invoices: 'invoiceId',
  ar_invoices: 'invoiceId',
  payroll_runs: 'runId',
  salary_slips: 'slipId',
  leave_records: 'recordId',
  leave_balances: 'balanceId',
  attendance: 'recordId',
  approval_requests: 'approvalId',
  hr_tasks: 'taskId',
  expense_entries: 'entryId',
  gst_input_ledger: 'ledgerId',
  gst_output_ledger: 'ledgerId',
  compliance_calendar: 'calendarId',
  tax_obligations: 'obligationId',
  tds_records: 'recordId',
  filing_history: 'filingId',
  audit_trail: 'entryId',
  chat_log: 'logId',
  agent_run_log: 'runId',
  policy_decisions: 'decisionId',
  policy_documents: 'docId',
  notification_log: 'notificationId',
  file_links: 'linkId',
};

// The corresponding snake_case name (how callers identify rows in payloads)
function inferIdField(table: string): string {
  const camel = TABLE_UNIQUE_FIELD[table];
  if (!camel) return 'id';
  return camelToSnake(camel);
}

// ─── Case conversion helpers ──────────────────────────────────────────────────

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Convert Prisma's camelCase row to the snake_case Record<string,string> the rest of the code expects. */
function rowToRecord(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id') continue; // internal cuid — not exposed
    out[camelToSnake(k)] = String(v ?? '');
  }
  return out;
}

/** Convert a snake_case payload to camelCase data object for Prisma writes. */
function payloadToPrismaData(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    // Strip tool dispatch / company filter fields that aren't schema columns
    if (k === 'tool_id' || k === 'id_field') continue;
    out[snakeToCamel(k)] = v ?? '';
  }
  return out;
}

// ─── In-memory fallback (no DATABASE_URL) ────────────────────────────────────

const memStore = new Map<string, Array<Record<string, unknown>>>();

function useDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** In production, DB errors do not silently fall back to memory unless VELO_ALLOW_MEM_DATA_FALLBACK=1. */
function allowInMemoryDataFallback(): boolean {
  if (process.env.VELO_ALLOW_MEM_DATA_FALLBACK === '0') return false;
  if (process.env.NODE_ENV === 'production') {
    return process.env.VELO_ALLOW_MEM_DATA_FALLBACK === '1';
  }
  return true;
}

function memCreate(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const rows = memStore.get(table) ?? [];
  const newRow = { ...row, _id: `${table}_${Date.now()}_${rows.length}`, created_at: new Date().toISOString() };
  rows.push(newRow);
  memStore.set(table, rows);
  return newRow;
}

function memFind(table: string, payload: Record<string, unknown>): Record<string, unknown>[] {
  return (memStore.get(table) ?? []).filter((r) =>
    Object.entries(payload).every(([k, v]) => {
      if (v === null || v === undefined || k === 'tool_id') return true;
      if (k === 'company_id') {
        const want = String(v).trim();
        if (!want) return true;
        return String(r.company_id ?? '').toLowerCase() === want.toLowerCase();
      }
      return String(r[k] ?? '').toLowerCase() === String(v).toLowerCase();
    })
  );
}

// ─── Shared filter / special-read logic ──────────────────────────────────────

function parseIsoDate(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

function filterRows(
  rows: Record<string, string>[],
  payload: Record<string, unknown>
): Record<string, string>[] {
  return rows.filter((row) =>
    Object.entries(payload).every(([k, v]) => {
      if (v === null || v === undefined || k === 'tool_id') return true;
      if (k === 'company_id') {
        const want = String(v).trim();
        if (!want) return true;
        return String(row.company_id ?? '').toLowerCase() === want.toLowerCase();
      }
      return row[k]?.toLowerCase() === String(v).toLowerCase();
    })
  );
}

function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/(private limited|pvt\.?\s*ltd\.?|llp|& co\.?|inc\.?|corp\.?|technologies|technology|tech|services|svcs|solutions|infra|infrastructure)/gi, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function charSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / longer.length;
}

function fuzzyNameMatch(rows: Record<string, string>[], nameQuery: string): Record<string, string>[] {
  const normalized = normalizeVendorName(nameQuery);
  return rows
    .filter((row) => {
      const name = normalizeVendorName(row.vendor_name ?? row.name ?? '');
      return name.includes(normalized) || normalized.includes(name) || charSimilarity(name, normalized) >= 0.7;
    })
    .slice(0, 5);
}

function runSpecialRead(
  table: string,
  operation: string,
  rows: Record<string, string>[],
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const companyId = String(payload.company_id ?? '').toLowerCase();

  if (table === 'file_links' && operation === 'get_by_scope') {
    const st = String(payload.scope_table ?? '');
    const sid = String(payload.scope_record_id ?? '');
    const role = String(payload.role ?? '');
    let filtered = rows;
    if (st) filtered = filtered.filter((r) => r.scope_table === st);
    if (sid) filtered = filtered.filter((r) => r.scope_record_id === sid);
    if (role) filtered = filtered.filter((r) => r.role === role);
    filtered.sort((a, b) => parseIsoDate(String(b.created_at ?? 0)) - parseIsoDate(String(a.created_at ?? 0)));
    return { ok: true, table, operation, count: filtered.length, rows: filtered };
  }

  if (table === 'bank_transactions') {
    let txRows = companyId
      ? rows.filter((r) => String(r.company_id ?? '').toLowerCase() === companyId)
      : [...rows];

    if (operation === 'get_by_date_range') {
      const from = String(payload.from_date ?? '');
      const to = String(payload.to_date ?? '');
      const fromT = from ? parseIsoDate(from) : 0;
      const toT = to ? parseIsoDate(to) + 86400000 : Number.MAX_SAFE_INTEGER;
      txRows = txRows.filter((r) => { const d = parseIsoDate(String(r.date ?? '')); return d >= fromT && d < toT; });
      txRows.sort((a, b) => parseIsoDate(String(b.date)) - parseIsoDate(String(a.date)));
      return { ok: true, table, operation, count: txRows.length, rows: txRows };
    }
    if (operation === 'get_latest_balance') {
      txRows.sort((a, b) => parseIsoDate(String(b.date)) - parseIsoDate(String(a.date)));
      const latest = txRows[0];
      const balance = latest ? parseFloat(String(latest.balance ?? '0')) || 0 : 0;
      return { ok: true, table, operation, balance_inr: balance, as_of_date: latest?.date ?? null, last_txn: latest ?? null, transaction_count: txRows.length };
    }
    if (operation === 'get_recent') {
      const limit = Number(payload.limit ?? 50);
      txRows.sort((a, b) => parseIsoDate(String(b.date)) - parseIsoDate(String(a.date)));
      return { ok: true, table, operation, count: Math.min(txRows.length, limit), rows: txRows.slice(0, Math.max(1, limit)) };
    }
  }

  if (table === 'payroll_runs' && operation === 'get_committed_salaries') {
    const committed = rows.filter((r) => { const s = (r.status ?? '').toLowerCase(); return s === 'approved' || s === 'committed' || s === 'paid' || s === 'complete'; });
    return { ok: true, table, operation, count: committed.length, rows: committed };
  }

  if (table === 'ap_invoices' && operation === 'get_pending_payables') {
    const pending = rows.filter((r) => { const ps = (r.payment_status ?? r.status ?? '').toLowerCase(); return ps !== 'paid' && ps !== 'cleared' && ps !== 'cancelled'; });
    return { ok: true, table, operation, count: pending.length, rows: pending };
  }

  if (table === 'ar_invoices' && operation === 'get_pending_receivables') {
    const pend = rows.filter((r) => { const s = (r.status ?? '').toLowerCase(); return s !== 'paid' && s !== 'cancelled'; });
    return { ok: true, table, operation, count: pend.length, rows: pend };
  }

  if (table === 'ar_invoices' && operation === 'get_overdue') {
    const now = Date.now();
    const overdue = rows.filter((r) => {
      const s = (r.status ?? '').toLowerCase();
      if (s === 'paid' || s === 'cancelled') return false;
      const due = new Date(r.due_date ?? '').getTime();
      return !isNaN(due) && due < now;
    });
    return { ok: true, table, operation, count: overdue.length, rows: overdue };
  }

  if (table === 'compliance_calendar' && operation === 'get_upcoming_obligations') {
    const daysAhead = Number(payload.days_ahead ?? 30);
    const now = Date.now();
    const filtered = rows.filter((r) => {
      if ((r.status ?? '').toLowerCase() === 'done') return false;
      const due = new Date(r.due_date ?? '').getTime();
      return !isNaN(due) && due >= now && due <= now + daysAhead * 86400000;
    });
    return { ok: true, table, operation, count: filtered.length, rows: filtered };
  }

  if (table === 'employees' && operation === 'get_active_headcount') {
    const active = rows.filter((r) => (r.status ?? '').toLowerCase() === 'active');
    return { ok: true, table, operation, headcount: active.length, rows: active };
  }

  if (table === 'hr_tasks' && operation === 'get_pending_hires') {
    const tasks = rows.filter((r) => {
      const tt = String(r.task_type ?? '').toLowerCase();
      const st = String(r.status ?? '').toLowerCase();
      return (tt.includes('onboard') || tt.includes('hire') || tt.includes('join')) && st !== 'completed' && st !== 'done' && st !== 'cancelled';
    });
    return { ok: true, table, operation, count: tasks.length, rows: tasks };
  }

  if (table === 'hr_tasks' && operation === 'get_blockers') {
    const blockers = rows.filter((r) => { const st = String(r.status ?? '').toLowerCase(); return st === 'blocked' || st === 'pending' || st === 'open'; });
    return { ok: true, table, operation, count: blockers.length, rows: blockers };
  }

  if (table === 'salary_slips' && operation === 'get_ytd_by_employee') {
    const eid = String(payload.employee_id ?? '');
    const year = String(payload.year ?? new Date().getFullYear());
    const ytd = rows.filter((r) => r.employee_id === eid && String(r.year ?? '') === year);
    const grossYtd = ytd.reduce((s, r) => s + (parseFloat(r.gross_salary ?? '0') || 0), 0);
    const netYtd = ytd.reduce((s, r) => s + (parseFloat(r.net_salary ?? '0') || 0), 0);
    return { ok: true, table, operation, employee_id: eid, year, slip_count: ytd.length, gross_ytd_inr: Math.round(grossYtd * 100) / 100, net_ytd_inr: Math.round(netYtd * 100) / 100, rows: ytd };
  }

  if (table === 'tds_records' && operation === 'get_by_employee_year') {
    const eid = String(payload.employee_id ?? '');
    const y = String(payload.period_year ?? payload.year ?? '');
    const found = rows.filter((r) => r.employee_id === eid && String(r.period_year ?? '') === y);
    return { ok: true, table, operation, count: found.length, rows: found };
  }

  if (table === 'gst_input_ledger' && operation === 'get_balance') {
    const period_month = String(payload.period_month ?? '');
    const period_year = String(payload.period_year ?? '');
    const periodRows = rows.filter((r) => r.period_month === period_month && r.period_year === period_year);
    const itc_total = periodRows.reduce((sum, r) => sum + (parseFloat(r.itc_amount ?? '0') || 0), 0);
    return { ok: true, table, operation, period_month, period_year, itc_total, rows: periodRows };
  }

  return null;
}

// ─── Postgres-backed employee + salary_structure combo ───────────────────────

async function getOwnSalaryStructureDb(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const employeeId = String(payload.employee_id ?? '');
  if (!employeeId) return { ok: false, error: 'employee_id is required' };
  try {
    const emp = await prisma.employee.findUnique({ where: { employeeId } });
    if (!emp) return { ok: false, error: `Employee not found: ${employeeId}` };
    const sid = emp.salaryStructureId;
    const st = sid ? await prisma.salaryStructure.findUnique({ where: { structureId: sid } }) : null;
    return { ok: true, employee: rowToRecord(emp as unknown as Record<string, unknown>), salary_structure: st ? rowToRecord(st as unknown as Record<string, unknown>) : null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Main Prisma dispatch ─────────────────────────────────────────────────────

type PrismaDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

function getModel(modelName: string): PrismaDelegate {
  return (prisma as unknown as Record<string, PrismaDelegate>)[modelName];
}

async function executeDbCreate(
  model: PrismaDelegate,
  table: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const rowsInput: Record<string, unknown>[] = Array.isArray(payload.rows)
    ? (payload.rows as Record<string, unknown>[])
    : [payload];

  for (const row of rowsInput) {
    const data = payloadToPrismaData({
      ...row,
      created_at: row.created_at ?? new Date().toISOString(),
    });
    await model.create({ data });
  }
  return { ok: true, table, operation: 'create', count: rowsInput.length };
}

async function executeDbUpdate(
  model: PrismaDelegate,
  table: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const idFieldSnake = String(payload.id_field ?? inferIdField(table));
  const idFieldCamel = snakeToCamel(idFieldSnake);
  const idValue = String(payload[idFieldSnake] ?? payload.id ?? '');
  if (!idValue) return { ok: false, error: `ID field '${idFieldSnake}' not provided` };

  const updates = payloadToPrismaData({
    ...payload,
    updated_at: new Date().toISOString(),
  });
  delete updates[snakeToCamel(idFieldSnake)]; // don't overwrite the unique key

  try {
    await model.update({ where: { [idFieldCamel]: idValue }, data: updates });
    return { ok: true, table, operation, updated_id: idValue };
  } catch {
    return { ok: false, error: `Row not found: ${idFieldSnake}=${idValue}` };
  }
}

async function executeDbRead(
  model: PrismaDelegate,
  table: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const companyIdFilter = String(payload.company_id ?? '').trim();
  /** Only bank_transactions currently stores company_id in Postgres (multi-tenant column). */
  const findManyArg =
    table === 'bank_transactions' && companyIdFilter
      ? { where: { companyId: companyIdFilter } }
      : {};

  const allRows = await model.findMany(findManyArg);
  const strRows = allRows.map((r: Record<string, unknown>) => rowToRecord(r));

  const special = runSpecialRead(table, operation, strRows, payload);
  if (special) return special;

  let filtered = strRows;

  if (operation === 'lookup_by_name_fuzzy') {
    filtered = fuzzyNameMatch(strRows, String(payload.vendor_name ?? payload.name ?? ''));
  } else if (operation === 'get_active') {
    filtered = strRows.filter((r) => r.status?.toLowerCase() === 'active');
  } else if (operation === 'get_outstanding') {
    filtered = strRows.filter((r) => { const s = r.status?.toLowerCase() ?? ''; return s !== 'paid' && s !== 'cancelled'; });
  } else if (operation === 'get_upcoming') {
    const daysAhead = Number(payload.days_ahead ?? 30);
    const now = Date.now();
    filtered = strRows.filter((r) => {
      if (r.status?.toLowerCase() === 'done') return false;
      const due = new Date(r.due_date ?? '').getTime();
      return !isNaN(due) && due >= now && due <= now + daysAhead * 86400000;
    });
  } else if (operation === 'lookup_by_gstin') {
    const gstin = String(payload.gstin ?? '').toLowerCase();
    filtered = strRows.filter((r) => r.gstin?.toLowerCase() === gstin);
  } else {
    const searchPayload = { ...payload };
    delete searchPayload.tool_id;
    filtered = filterRows(strRows, searchPayload);
  }

  return { ok: true, table, operation, count: filtered.length, rows: filtered };
}

async function executeSheetToolDb(
  table: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (table === 'employees' && operation === 'get_own_salary_structure') {
    return getOwnSalaryStructureDb({ ...payload });
  }

  const modelName = TABLE_TO_MODEL[table];
  if (!modelName) return { ok: false, error: `Unknown table: ${table}`, table };

  const model = getModel(modelName);

  if (operation === 'create' || operation === 'create_batch') {
    return executeDbCreate(model, table, payload);
  }
  if (operation === 'update' || operation === 'update_status' || operation === 'mark_done') {
    return executeDbUpdate(model, table, operation, payload);
  }
  return executeDbRead(model, table, operation, payload);
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

function executeSheetToolInMemory(
  table: string,
  operation: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (operation === 'create' || operation === 'create_batch') {
    const rowsInput: Record<string, unknown>[] = Array.isArray(payload.rows)
      ? (payload.rows as Record<string, unknown>[])
      : [payload];
    const created = rowsInput.map((r) => memCreate(table, r));
    return { ok: true, table, operation, count: created.length, rows: created };
  }
  if (operation === 'update' || operation === 'update_status' || operation === 'mark_done') {
    const tableRows = memStore.get(table) ?? [];
    const idField = String(payload.id_field ?? inferIdField(table));
    const idValue = String(payload[idField] ?? payload.id ?? '');
    const idx = tableRows.findIndex((r) => String(r[idField] ?? r.id ?? r._id) === idValue);
    if (idx < 0) return { ok: false, error: `Row not found: ${idField}=${idValue}` };
    tableRows[idx] = { ...tableRows[idx], ...payload, updated_at: new Date().toISOString() };
    memStore.set(table, tableRows);
    return { ok: true, table, operation, updated_id: idValue };
  }

  const tableRows = memStore.get(table) ?? [];
  const strRows = tableRows.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) o[k] = String(v ?? '');
    return o;
  });
  const specialMem = runSpecialRead(table, operation, strRows, payload);
  if (specialMem) return specialMem;

  if (operation === 'lookup_by_name_fuzzy') {
    const matched = fuzzyNameMatch(strRows, String(payload.vendor_name ?? payload.name ?? ''));
    return { ok: true, table, operation, count: matched.length, rows: matched };
  }
  if (operation === 'get_active') {
    const active = strRows.filter((r) => String(r.status ?? '').toLowerCase() === 'active');
    return { ok: true, table, operation, count: active.length, rows: active };
  }
  const searchPayload = { ...payload };
  delete searchPayload.tool_id;
  const found = memFind(table, searchPayload);
  return { ok: true, table, operation, count: found.length, rows: found };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function executeSheetTool(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const rawToolId = String(params.tool_id ?? 'sheets.unknown.create');
  const toolId = canonicalVeloDataToolId(rawToolId);
  const parts = toolId.split('.');
  const table = parts[1] ?? 'default';
  const operation = parts[2] ?? 'create';
  const payload = (params.payload ?? params) as Record<string, unknown>;

  if (!useDatabase()) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        error: 'DATABASE_URL is required in production.',
        table,
        operation,
      };
    }
    if (!allowInMemoryDataFallback()) {
      return { ok: false, error: 'DATABASE_URL is not configured.', table, operation };
    }
    return executeSheetToolInMemory(table, operation, payload);
  }

  try {
    return await executeSheetToolDb(table, operation, payload);
  } catch (err) {
    console.error(`[db] executeSheetTool failed for ${toolId}:`, err);
    if (!allowInMemoryDataFallback()) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        table,
        operation,
      };
    }
    return executeSheetToolInMemory(table, operation, payload);
  }
}

// ─── file_links helpers ───────────────────────────────────────────────────────

export const FILE_LINKS_COLUMN_ORDER = [
  'link_id', 'scope_table', 'scope_record_id', 'role', 'drive_file_id',
  'drive_web_view_url', 'mime', 'filename', 'local_upload_id', 'source', 'meta_json', 'created_at',
] as const;

export type VeloFileLinkInput = {
  scope_table: string;
  scope_record_id: string;
  role: string;
  drive_file_id: string;
  drive_web_view_url: string;
  mime?: string;
  filename?: string;
  local_upload_id?: string;
  source?: string;
  meta_json?: string;
};

export async function recordVeloFileLink(input: VeloFileLinkInput): Promise<void> {
  const linkId = `fl_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  const row = {
    linkId,
    scopeTable: input.scope_table,
    scopeRecordId: input.scope_record_id,
    role: input.role,
    driveFileId: input.drive_file_id,
    driveWebViewUrl: input.drive_web_view_url,
    mime: input.mime ?? '',
    filename: input.filename ?? '',
    localUploadId: input.local_upload_id ?? '',
    source: input.source ?? '',
    metaJson: input.meta_json ?? '',
    createdAt: new Date().toISOString(),
  };

  if (!useDatabase()) {
    memCreate('file_links', { link_id: linkId, ...payloadToPrismaData(row) });
    return;
  }
  try {
    await prisma.fileLink.create({ data: row });
  } catch (err) {
    console.error('[db] recordVeloFileLink failed:', err);
    memCreate('file_links', { link_id: linkId, ...payloadToPrismaData(row) });
  }
}

export async function fetchFileLinksForScope(
  scope_table: string,
  scope_record_id: string
): Promise<Record<string, string>[]> {
  if (!useDatabase()) {
    return (memStore.get('file_links') ?? [])
      .filter((r) => String(r.scope_table ?? '') === scope_table && String(r.scope_record_id ?? '') === scope_record_id)
      .map((r) => { const o: Record<string, string> = {}; for (const [k, v] of Object.entries(r)) o[k] = String(v ?? ''); return o; });
  }
  try {
    const rows = await prisma.fileLink.findMany({
      where: { scopeTable: scope_table, scopeRecordId: scope_record_id },
    });
    type Row = (typeof rows)[number];
    return rows.map((r: Row) => rowToRecord(r as unknown as Record<string, unknown>));
  } catch { return []; }
}

export async function mergeApprovalAttachmentsFromFileLinks(
  approvalId: string,
  existingAttachmentCell: string
): Promise<string> {
  const linkRows = await fetchFileLinksForScope(APPROVAL_FILE_LINK_SCOPE, approvalId);
  return mergeFileLinkRowsIntoApprovalAttachmentsJson(existingAttachmentCell, linkRows);
}

// ─── Audit trail append ───────────────────────────────────────────────────────

export async function appendAuditRow(row: Record<string, unknown>): Promise<void> {
  if (!useDatabase()) {
    memCreate('audit_trail', row);
    return;
  }
  try {
    const entryId = String(row.entry_id ?? `at_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`);
    await prisma.auditTrailEntry.create({
      data: {
        entryId,
        timestamp: String(row.timestamp ?? new Date().toISOString()),
        actorId: String(row.actor_id ?? ''),
        actorRole: String(row.actor_role ?? ''),
        agentId: String(row.agent_id ?? ''),
        actionType: String(row.action_type ?? ''),
        module: String(row.module ?? ''),
        recordId: String(row.record_id ?? ''),
        oldValueJson: String(row.old_value_json ?? ''),
        newValueJson: String(row.new_value_json ?? ''),
        status: String(row.status ?? ''),
        sessionId: String(row.session_id ?? ''),
      },
    });
  } catch (err) {
    console.error('[db] appendAuditRow failed:', err);
  }
}

// ─── Approval helpers ─────────────────────────────────────────────────────────

export async function findApprovalById(
  approvalId: string
): Promise<{ row: Record<string, string>; rowIndex: number; headers: string[]; spreadsheetId: string } | null> {
  const normalizedId = String(approvalId).trim();

  if (!useDatabase()) {
    const rows = memStore.get('approval_requests') ?? [];
    const idx = rows.findIndex((r) => String(r.approval_id ?? r.id).trim() === normalizedId);
    if (idx < 0) return null;
    return { row: rows[idx] as Record<string, string>, rowIndex: idx, headers: Object.keys(rows[idx]), spreadsheetId: 'mem' };
  }

  try {
    const rec = await prisma.approvalRequest.findUnique({ where: { approvalId: normalizedId } });
    if (!rec) return null;
    return { row: rowToRecord(rec as unknown as Record<string, unknown>), rowIndex: 0, headers: [], spreadsheetId: 'pg' };
  } catch { return null; }
}

export async function updateApprovalRow(
  spreadsheetId: string,
  _rowIndex: number,
  _headers: string[],
  updates: Record<string, unknown>
): Promise<void> {
  const approvalId = String(updates.approval_id ?? updates.approvalId ?? '');

  if (spreadsheetId === 'mem') {
    const rows = memStore.get('approval_requests') ?? [];
    const idx = rows.findIndex((r) => String(r.approval_id ?? '') === approvalId);
    if (idx >= 0) rows[idx] = { ...rows[idx], ...updates };
    memStore.set('approval_requests', rows);
    return;
  }

  if (!approvalId) return;
  try {
    const data = payloadToPrismaData(updates);
    delete data.approvalId; // don't overwrite the unique key
    await prisma.approvalRequest.update({ where: { approvalId }, data });
  } catch (err) {
    console.error('[db] updateApprovalRow failed:', err);
  }
}

export async function listPendingApprovals(limit = 10): Promise<Record<string, string>[]> {
  const cap = Math.max(1, Math.min(100, limit));

  if (!useDatabase()) {
    const rows = memStore.get('approval_requests') ?? [];
    return rows
      .filter((r) => isApprovalPendingStatus(r.status))
      .slice(-cap)
      .reverse()
      .map((r) => { const o: Record<string, string> = {}; for (const [k, v] of Object.entries(r)) o[k] = String(v ?? ''); return o; });
  }

  try {
    const rows = await prisma.approvalRequest.findMany({
      where: { status: { in: ['PENDING', 'pending', 'Pending'] } },
      orderBy: { createdAt: 'desc' },
      take: cap,
    });
    type Row = (typeof rows)[number];
    return rows.map((r: Row) => rowToRecord(r as unknown as Record<string, unknown>));
  } catch { return []; }
}

export async function expireStalePendingApprovals(): Promise<{ count: number; approval_ids: string[] }> {
  const now = new Date().toISOString();
  const approval_ids: string[] = [];

  if (!useDatabase()) {
    const rows = (memStore.get('approval_requests') ?? []) as Record<string, unknown>[];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!isApprovalPendingStatus(r.status)) continue;
      const exp = Date.parse(String(r.expires_at ?? ''));
      if (!Number.isNaN(exp) && exp < Date.now()) {
        rows[i] = { ...r, status: 'EXPIRED', resolved_at: now, resolution_notes: 'auto_expired_velo_cron', resolved_by: 'system' };
        approval_ids.push(String(r.approval_id ?? ''));
      }
    }
    memStore.set('approval_requests', rows);
    return { count: approval_ids.length, approval_ids };
  }

  try {
    // Find all PENDING rows that have expired
    const pending = await prisma.approvalRequest.findMany({
      where: { status: { in: ['PENDING', 'pending', 'Pending'] } },
      select: { approvalId: true, expiresAt: true },
    });
    type PendingRow = (typeof pending)[number];
    const toExpire = pending.filter((r: PendingRow) => {
      const exp = Date.parse(r.expiresAt);
      return !Number.isNaN(exp) && exp < Date.now();
    });
    for (const r of toExpire) {
      await prisma.approvalRequest.update({
        where: { approvalId: r.approvalId },
        data: { status: 'EXPIRED', resolvedAt: now, resolutionNotes: 'auto_expired_velo_cron', resolvedBy: 'system' },
      });
      approval_ids.push(r.approvalId);
    }
    return { count: approval_ids.length, approval_ids };
  } catch { return { count: 0, approval_ids: [] }; }
}

// Legacy in-memory list (kept for any internal callers)
export function listSheetTable(table: string): Array<Record<string, unknown>> {
  return memStore.get(table) ?? [];
}
