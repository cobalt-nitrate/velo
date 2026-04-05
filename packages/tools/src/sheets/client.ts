// Google Sheets client for Velo.
// Uses service account credentials from env vars.
// Falls back to in-memory store when credentials are not configured (local dev without Sheets).

import { google } from 'googleapis';

// ─── Table → Spreadsheet mapping ─────────────────────────────────────────────

const TABLE_MAP: Record<string, { envKey: string; sheetName: string }> = {
  // TRANSACTIONS spreadsheet
  ap_invoices:       { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'ap_invoices' },
  ar_invoices:       { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'ar_invoices' },
  expense_entries:   { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'expense_entries' },
  approval_requests: { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'approval_requests' },
  payroll_runs:      { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'payroll_runs' },
  salary_slips:      { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'salary_slips' },
  leave_records:     { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'leave_records' },
  leave_balances:    { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'leave_balances' },
  attendance:        { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'attendance' },
  hr_tasks:          { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'hr_tasks' },
  bank_transactions: { envKey: 'SHEETS_TRANSACTIONS_ID', sheetName: 'bank_transactions' },

  // MASTER spreadsheet
  employees:         { envKey: 'SHEETS_MASTER_ID', sheetName: 'employees' },
  salary_structures: { envKey: 'SHEETS_MASTER_ID', sheetName: 'salary_structures' },
  vendor_master:     { envKey: 'SHEETS_MASTER_ID', sheetName: 'vendor_master' },
  client_master:     { envKey: 'SHEETS_MASTER_ID', sheetName: 'client_master' },
  bank_payees:       { envKey: 'SHEETS_MASTER_ID', sheetName: 'bank_payees' },

  // COMPLIANCE spreadsheet
  tax_obligations:      { envKey: 'SHEETS_COMPLIANCE_ID', sheetName: 'tax_obligations' },
  gst_input_ledger:     { envKey: 'SHEETS_COMPLIANCE_ID', sheetName: 'gst_input_ledger' },
  gst_output_ledger:    { envKey: 'SHEETS_COMPLIANCE_ID', sheetName: 'gst_output_ledger' },
  compliance_calendar:  { envKey: 'SHEETS_COMPLIANCE_ID', sheetName: 'compliance_calendar' },
  tds_records:          { envKey: 'SHEETS_COMPLIANCE_ID', sheetName: 'tds_records' },
  filing_history:       { envKey: 'SHEETS_COMPLIANCE_ID', sheetName: 'filing_history' },

  // LOGS spreadsheet
  audit_trail:      { envKey: 'SHEETS_LOGS_ID', sheetName: 'audit_trail' },
  chat_log:         { envKey: 'SHEETS_LOGS_ID', sheetName: 'chat_log' },
  agent_run_log:    { envKey: 'SHEETS_LOGS_ID', sheetName: 'agent_run_log' },
  policy_decisions: { envKey: 'SHEETS_LOGS_ID', sheetName: 'policy_decisions' },
  policy_documents: { envKey: 'SHEETS_LOGS_ID', sheetName: 'policy_documents' },
  notification_log: { envKey: 'SHEETS_LOGS_ID', sheetName: 'notification_log' },

  // CONFIG spreadsheet
  company_settings:  { envKey: 'SHEETS_CONFIG_ID', sheetName: 'company_settings' },
  tax_rates:         { envKey: 'SHEETS_CONFIG_ID', sheetName: 'tax_rates' },
  expense_categories:{ envKey: 'SHEETS_CONFIG_ID', sheetName: 'expense_categories' },
  payroll_components:{ envKey: 'SHEETS_CONFIG_ID', sheetName: 'payroll_components' },
  leave_types:       { envKey: 'SHEETS_CONFIG_ID', sheetName: 'leave_types' },
  compliance_rules:  { envKey: 'SHEETS_CONFIG_ID', sheetName: 'compliance_rules' },
};

// ─── In-memory fallback ────────────────────────────────────────────────────

const memStore = new Map<string, Array<Record<string, unknown>>>();

function useRealSheets(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.SHEETS_TRANSACTIONS_ID
  );
}

// ─── Auth ────────────────────────────────────────────────────────────────────

let cachedAuthClient: ReturnType<typeof google.auth.GoogleAuth.prototype.getClient> | null = null;

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient as Parameters<typeof google.sheets>[0]['auth'] });
}

/** Max data rows read in one request (rectangle A1:ZZ…); keeps responses well under API size limits. */
const SHEET_READ_MAX_ROW = 20_000;

const sheetTabTitlesCache = new Map<string, { titles: Set<string>; at: number }>();
const SHEET_TAB_TITLES_TTL_MS = 30_000;

async function getSheetTabTitles(spreadsheetId: string): Promise<Set<string>> {
  const now = Date.now();
  const hit = sheetTabTitlesCache.get(spreadsheetId);
  if (hit && now - hit.at < SHEET_TAB_TITLES_TTL_MS) return hit.titles;

  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titles = new Set(
    (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
  );
  sheetTabTitlesCache.set(spreadsheetId, { titles, at: now });
  return titles;
}

// ─── Core read/write helpers ──────────────────────────────────────────────────

function sheetRangeA1(sheetName: string): string {
  if (sheetName.includes('!')) return sheetName;
  const q = sheetName.includes(' ')
    ? `'${sheetName.replace(/'/g, "''")}'`
    : sheetName;
  // Bounded A1 rectangle (API is picky; missing tabs also surface as "Unable to parse range").
  return `${q}!A1:ZZ${SHEET_READ_MAX_ROW}`;
}

async function readSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const tabTitles = await getSheetTabTitles(spreadsheetId);
  if (!tabTitles.has(sheetName)) {
    console.warn(
      `[sheets] Tab "${sheetName}" is not in spreadsheet ${spreadsheetId}; returning empty rows (add the tab or run setup).`
    );
    return { headers: [], rows: [] };
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRangeA1(sheetName),
  });
  const values = res.data.values ?? [];
  if (values.length === 0) return { headers: [], rows: [] };
  const headers = values[0] as string[];
  const rows = values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '') as string;
    });
    return obj;
  });
  return { headers, rows };
}

async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rowData: Record<string, unknown>
): Promise<void> {
  const sheets = await getSheetsClient();
  const row = headers.map((h) => String(rowData[h] ?? ''));
  const base = sheetName.includes(' ')
    ? `'${sheetName.replace(/'/g, "''")}'`
    : sheetName;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${base}!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

async function updateRow(
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rowIndex: number, // 0-based data row (excludes header row)
  updates: Record<string, unknown>
): Promise<void> {
  const sheets = await getSheetsClient();
  // Row 1 = header, so data row 0 = sheet row 2
  const sheetRowNumber = rowIndex + 2;
  const requests = Object.entries(updates)
    .map(([key, value]) => {
      const colIndex = headers.indexOf(key);
      if (colIndex < 0) return null;
      const colLetter = columnLetter(colIndex + 1);
      const base = sheetName.includes(' ')
        ? `'${sheetName.replace(/'/g, "''")}'`
        : sheetName;
      return {
        range: `${base}!${colLetter}${sheetRowNumber}`,
        values: [[String(value ?? '')]],
      };
    })
    .filter(Boolean) as Array<{ range: string; values: string[][] }>;

  if (requests.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: requests,
    },
  });
}

function columnLetter(n: number): string {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function parseIsoDate(s: string): number {
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

/** Shared read logic for synthetic sheet operations (used by real Sheets + in-memory). */
function runSpecialRead(
  table: string,
  operation: string,
  rows: Record<string, string>[],
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const companyId = String(payload.company_id ?? '').toLowerCase();

  if (table === 'bank_transactions') {
    let txRows = companyId
      ? rows.filter((r) => String(r.company_id ?? '').toLowerCase() === companyId)
      : [...rows];

    if (operation === 'get_by_date_range') {
      const from = String(payload.from_date ?? '');
      const to = String(payload.to_date ?? '');
      const fromT = from ? parseIsoDate(from) : 0;
      const toT = to ? parseIsoDate(to) + 86400000 : Number.MAX_SAFE_INTEGER;
      txRows = txRows.filter((r) => {
        const d = parseIsoDate(String(r.date ?? ''));
        return d >= fromT && d < toT;
      });
      txRows.sort((a, b) => parseIsoDate(String(b.date)) - parseIsoDate(String(a.date)));
      return { ok: true, table, operation, count: txRows.length, rows: txRows };
    }

    if (operation === 'get_latest_balance') {
      txRows.sort((a, b) => parseIsoDate(String(b.date)) - parseIsoDate(String(a.date)));
      const latest = txRows[0];
      const balance = latest ? parseFloat(String(latest.balance ?? '0')) || 0 : 0;
      return {
        ok: true,
        table,
        operation,
        balance_inr: balance,
        as_of_date: latest?.date ?? null,
        last_txn: latest ?? null,
        transaction_count: txRows.length,
      };
    }

    if (operation === 'get_recent') {
      const limit = Number(payload.limit ?? 50);
      txRows.sort((a, b) => parseIsoDate(String(b.date)) - parseIsoDate(String(a.date)));
      const sliced = txRows.slice(0, Math.max(1, limit));
      return { ok: true, table, operation, count: sliced.length, rows: sliced };
    }
  }

  if (table === 'payroll_runs' && operation === 'get_committed_salaries') {
    const committed = rows.filter((r) => {
      const s = (r.status ?? '').toLowerCase();
      return s === 'approved' || s === 'committed' || s === 'paid' || s === 'complete';
    });
    return { ok: true, table, operation, count: committed.length, rows: committed };
  }

  if (table === 'ap_invoices' && operation === 'get_pending_payables') {
    const pending = rows.filter((r) => {
      const ps = (r.payment_status ?? r.status ?? '').toLowerCase();
      return ps !== 'paid' && ps !== 'cleared' && ps !== 'cancelled';
    });
    return { ok: true, table, operation, count: pending.length, rows: pending };
  }

  if (table === 'ar_invoices' && operation === 'get_pending_receivables') {
    const pend = rows.filter((r) => {
      const s = (r.status ?? '').toLowerCase();
      return s !== 'paid' && s !== 'cancelled';
    });
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
    return {
      ok: true,
      table,
      operation,
      headcount: active.length,
      rows: active,
    };
  }

  if (table === 'hr_tasks' && operation === 'get_pending_hires') {
    const tasks = rows.filter((r) => {
      const tt = String(r.task_type ?? '').toLowerCase();
      const st = String(r.status ?? '').toLowerCase();
      const isHire = tt.includes('onboard') || tt.includes('hire') || tt.includes('join');
      return isHire && st !== 'completed' && st !== 'done' && st !== 'cancelled';
    });
    return { ok: true, table, operation, count: tasks.length, rows: tasks };
  }

  if (table === 'hr_tasks' && operation === 'get_blockers') {
    const blockers = rows.filter((r) => {
      const st = String(r.status ?? '').toLowerCase();
      return st === 'blocked' || st === 'pending' || st === 'open';
    });
    return { ok: true, table, operation, count: blockers.length, rows: blockers };
  }

  if (table === 'salary_slips' && operation === 'get_ytd_by_employee') {
    const eid = String(payload.employee_id ?? '');
    const year = String(payload.year ?? new Date().getFullYear());
    const ytd = rows.filter(
      (r) => r.employee_id === eid && String(r.year ?? '') === year
    );
    const grossYtd = ytd.reduce((s, r) => s + (parseFloat(r.gross_salary ?? '0') || 0), 0);
    const netYtd = ytd.reduce((s, r) => s + (parseFloat(r.net_salary ?? '0') || 0), 0);
    return {
      ok: true,
      table,
      operation,
      employee_id: eid,
      year,
      slip_count: ytd.length,
      gross_ytd_inr: Math.round(grossYtd * 100) / 100,
      net_ytd_inr: Math.round(netYtd * 100) / 100,
      rows: ytd,
    };
  }

  if (table === 'tds_records' && operation === 'get_by_employee_year') {
    const eid = String(payload.employee_id ?? '');
    const y = String(payload.period_year ?? payload.year ?? '');
    const found = rows.filter((r) => r.employee_id === eid && String(r.period_year ?? '') === y);
    return { ok: true, table, operation, count: found.length, rows: found };
  }

  return null;
}

async function getOwnSalaryStructureCombo(
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const employeeId = String(payload.employee_id ?? '');
  if (!employeeId) {
    return { ok: false, error: 'employee_id is required' };
  }

  if (!useRealSheets()) {
    const emps = memStore.get('employees') ?? [];
    const emp = emps.find((r) => String(r.employee_id ?? '') === employeeId);
    if (!emp) return { ok: false, error: `Employee not found: ${employeeId}` };
    const structs = memStore.get('salary_structures') ?? [];
    const sid = String(emp.salary_structure_id ?? '');
    const st = structs.find((r) => String(r.structure_id ?? '') === sid);
    return { ok: true, employee: emp, salary_structure: st ?? null };
  }

  const masterId = process.env.SHEETS_MASTER_ID;
  if (!masterId) {
    return { ok: false, error: 'SHEETS_MASTER_ID not configured' };
  }

  try {
    const { rows: empRows } = await readSheet(masterId, 'employees');
    const emp = empRows.find((r) => r.employee_id === employeeId);
    if (!emp) return { ok: false, error: `Employee not found: ${employeeId}` };
    const sid = emp.salary_structure_id ?? '';
    const { rows: structRows } = await readSheet(masterId, 'salary_structures');
    const st = structRows.find((r) => r.structure_id === sid);
    return {
      ok: true,
      employee: emp as unknown as Record<string, string>,
      salary_structure: st ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function filterRows(
  rows: Record<string, string>[],
  payload: Record<string, unknown>
): Record<string, string>[] {
  return rows.filter((row) =>
    Object.entries(payload).every(([k, v]) => {
      if (v === null || v === undefined || k === 'tool_id' || k === 'company_id') return true;
      return row[k]?.toLowerCase() === String(v).toLowerCase();
    })
  );
}

function fuzzyNameMatch(rows: Record<string, string>[], nameQuery: string): Record<string, string>[] {
  const normalized = normalizeVendorName(nameQuery);
  return rows
    .filter((row) => {
      const name = normalizeVendorName(row.vendor_name ?? row.name ?? '');
      return name.includes(normalized) || normalized.includes(name) || similarity(name, normalized) >= 0.7;
    })
    .slice(0, 5);
}

function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/(private limited|pvt\.?\s*ltd\.?|llp|& co\.?|inc\.?|corp\.?|technologies|technology|tech|services|svcs|solutions|infra|infrastructure)/gi, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
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

// ─── In-memory fallback ops ────────────────────────────────────────────────

function memCreate(table: string, row: Record<string, unknown>) {
  const tableRows = memStore.get(table) ?? [];
  const newRow = {
    ...row,
    id: `${table}_${Date.now()}_${tableRows.length + 1}`,
    created_at: new Date().toISOString(),
  };
  tableRows.push(newRow);
  memStore.set(table, tableRows);
  return newRow;
}

function memFind(table: string, payload: Record<string, unknown>) {
  const tableRows = memStore.get(table) ?? [];
  return tableRows.filter((r) =>
    Object.entries(payload).every(([k, v]) => {
      if (v === null || v === undefined || k === 'tool_id' || k === 'company_id') return true;
      return String(r[k] ?? '').toLowerCase() === String(v).toLowerCase();
    })
  );
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function executeSheetTool(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const toolId = String(params.tool_id ?? 'sheets.unknown.create');
  const parts = toolId.split('.');
  const table = parts[1] ?? 'default';
  const operation = parts[2] ?? 'create';
  const payload = (params.payload ?? params) as Record<string, unknown>;

  if (table === 'employees' && operation === 'get_own_salary_structure') {
    return getOwnSalaryStructureCombo({ ...payload, ...params });
  }

  // Fall back to in-memory when Sheets credentials aren't configured
  if (!useRealSheets()) {
    return executeSheetToolInMemory(table, operation, payload);
  }

  const mapping = TABLE_MAP[table];
  if (!mapping) {
    // Unknown table → in-memory fallback
    return executeSheetToolInMemory(table, operation, payload);
  }

  const spreadsheetId = process.env[mapping.envKey];
  if (!spreadsheetId) {
    return executeSheetToolInMemory(table, operation, payload);
  }

  try {
    return await executeSheetToolReal(spreadsheetId, mapping.sheetName, table, operation, payload);
  } catch (err) {
    // Log and fall back gracefully
    console.error(`[sheets] Real API failed for ${toolId}:`, err);
    return executeSheetToolInMemory(table, operation, payload);
  }
}

async function executeSheetToolReal(
  spreadsheetId: string,
  sheetName: string,
  table: string,
  operation: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { headers, rows } = await readSheet(spreadsheetId, sheetName);

  // ── CREATE ────────────────────────────────────────────────────────────────
  if (operation === 'create' || operation === 'create_batch') {
    const rowsToCreate = Array.isArray(payload.rows)
      ? (payload.rows as Record<string, unknown>[])
      : [payload];

    for (const row of rowsToCreate) {
      const newRow: Record<string, unknown> = {
        ...row,
        created_at: row.created_at ?? new Date().toISOString(),
      };
      await appendRow(spreadsheetId, sheetName, headers, newRow);
    }
    return { ok: true, table, operation, count: rowsToCreate.length };
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  if (operation === 'update' || operation === 'update_status' || operation === 'mark_done') {
    const idField = payload.id_field as string | undefined ?? inferIdField(table);
    const idValue = String(payload[idField] ?? payload.id ?? '');
    const rowIndex = rows.findIndex((r) => r[idField] === idValue);
    if (rowIndex < 0) {
      return { ok: false, error: `Row not found: ${idField}=${idValue}` };
    }
    const updates = { ...payload, updated_at: new Date().toISOString() };
    delete (updates as Record<string, unknown>).id_field;
    await updateRow(spreadsheetId, sheetName, headers, rowIndex, updates);
    return { ok: true, table, operation, updated_id: idValue };
  }

  // ── READS ──────────────────────────────────────────────────────────────────
  if (
    operation === 'find_by_vendor_amount_date' ||
    operation === 'lookup_by_gstin' ||
    operation === 'lookup_by_name_fuzzy' ||
    operation === 'lookup' ||
    operation === 'get_by_period' ||
    operation === 'get_by_id' ||
    operation === 'get_by_quarter' ||
    operation === 'get_by_employee' ||
    operation === 'get_by_employee_month' ||
    operation === 'get_by_type' ||
    operation === 'get_upcoming' ||
    operation === 'get_balance' ||
    operation === 'get_active' ||
    operation === 'get_own_record' ||
    operation === 'get_outstanding' ||
    operation === 'get_recent' ||
    operation === 'get_by_period' ||
    operation === 'get_latest_balance' ||
    operation === 'get_by_date_range' ||
    operation === 'get_committed_salaries' ||
    operation === 'get_pending_payables' ||
    operation === 'get_pending_receivables' ||
    operation === 'get_overdue' ||
    operation === 'get_upcoming_obligations' ||
    operation === 'get_active_headcount' ||
    operation === 'get_pending_hires' ||
    operation === 'get_blockers' ||
    operation === 'get_ytd_by_employee' ||
    operation === 'get_by_employee_year'
  ) {
    const special = runSpecialRead(table, operation, rows, payload);
    if (special) return special;

    let filtered = rows;

    if (operation === 'lookup_by_name_fuzzy') {
      filtered = fuzzyNameMatch(rows, String(payload.vendor_name ?? payload.name ?? ''));
    } else if (operation === 'get_active') {
      filtered = rows.filter((r) => r.status?.toLowerCase() === 'active');
    } else if (operation === 'get_outstanding') {
      filtered = rows.filter((r) => {
        const s = r.status?.toLowerCase() ?? '';
        return s !== 'paid' && s !== 'cancelled';
      });
    } else if (operation === 'get_upcoming') {
      const daysAhead = Number(payload.days_ahead ?? 30);
      const now = Date.now();
      filtered = rows.filter((r) => {
        if (r.status?.toLowerCase() === 'done') return false;
        const due = new Date(r.due_date ?? '').getTime();
        return !isNaN(due) && due >= now && due <= now + daysAhead * 86400000;
      });
    } else if (operation === 'get_balance') {
      // Sum ITC amounts
      const period_month = String(payload.period_month ?? '');
      const period_year = String(payload.period_year ?? '');
      const periodRows = rows.filter(
        (r) => r.period_month === period_month && r.period_year === period_year
      );
      const itc_total = periodRows.reduce((sum, r) => sum + (parseFloat(r.itc_amount ?? '0') || 0), 0);
      return { ok: true, table, operation, period_month, period_year, itc_total, rows: periodRows };
    } else {
      // Generic filter on payload fields
      const searchPayload = { ...payload };
      delete searchPayload.tool_id;
      delete searchPayload.company_id;
      filtered = filterRows(rows, searchPayload);
    }

    return { ok: true, table, operation, count: filtered.length, rows: filtered };
  }

  // ── FALLBACK ───────────────────────────────────────────────────────────────
  return { ok: false, error: `Unknown operation: ${operation}`, table };
}

function inferIdField(table: string): string {
  const idFieldMap: Record<string, string> = {
    ap_invoices: 'invoice_id',
    ar_invoices: 'invoice_id',
    employees: 'employee_id',
    approval_requests: 'approval_id',
    payroll_runs: 'run_id',
    salary_slips: 'slip_id',
    vendor_master: 'vendor_id',
    compliance_calendar: 'calendar_id',
    leave_records: 'record_id',
    leave_balances: 'balance_id',
    hr_tasks: 'task_id',
    bank_transactions: 'txn_id',
  };
  return idFieldMap[table] ?? 'id';
}

function executeSheetToolInMemory(
  table: string,
  operation: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (operation === 'create' || operation === 'create_batch') {
    const rowsToCreate = Array.isArray(payload.rows)
      ? (payload.rows as Record<string, unknown>[])
      : [payload];
    const created = rowsToCreate.map((r) => memCreate(table, r));
    return { ok: true, table, operation, count: created.length, rows: created };
  }

  if (operation === 'update' || operation === 'update_status' || operation === 'mark_done') {
    const tableRows = memStore.get(table) ?? [];
    const idField = String(payload.id_field ?? inferIdField(table));
    const idValue = String(payload[idField] ?? payload.id ?? '');
    const idx = tableRows.findIndex((r) => String(r[idField] ?? r.id) === idValue);
    if (idx < 0) return { ok: false, error: `Row not found: ${idField}=${idValue}` };
    tableRows[idx] = { ...tableRows[idx], ...payload, updated_at: new Date().toISOString() };
    memStore.set(table, tableRows);
    return { ok: true, table, operation, updated_id: idValue };
  }

  // All read operations
  const tableRows = memStore.get(table) ?? [];
  const strRows: Record<string, string>[] = tableRows.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r))
      o[k] = String(v ?? '');
    return o;
  });
  const specialMem = runSpecialRead(table, operation, strRows, payload);
  if (specialMem) return specialMem;

  if (operation === 'lookup_by_name_fuzzy') {
    const name = String(payload.vendor_name ?? payload.name ?? '');
    const matched = tableRows.filter((r) => {
      const rowName = String(r.vendor_name ?? r.name ?? '');
      return normalizeVendorName(rowName).includes(normalizeVendorName(name));
    });
    return { ok: true, table, operation, count: matched.length, rows: matched };
  }
  if (operation === 'get_active') {
    const active = tableRows.filter((r) => String(r.status ?? '').toLowerCase() === 'active');
    return { ok: true, table, operation, count: active.length, rows: active };
  }

  const searchPayload = { ...payload };
  delete searchPayload.tool_id;
  delete searchPayload.company_id;
  const found = memFind(table, searchPayload);
  return { ok: true, table, operation, count: found.length, rows: found };
}

// ─── Direct append for AuditLogger (bypasses tool dispatch) ───────────────────

export async function appendAuditRow(row: Record<string, unknown>): Promise<void> {
  const spreadsheetId = process.env.SHEETS_LOGS_ID;
  if (!spreadsheetId || !useRealSheets()) {
    memCreate('audit_trail', row);
    return;
  }
  try {
    const { headers } = await readSheet(spreadsheetId, 'audit_trail');
    if (headers.length > 0) {
      await appendRow(spreadsheetId, 'audit_trail', headers, row);
    }
  } catch (err) {
    console.error('[sheets] audit_trail append failed:', err);
  }
}

// ─── Direct read for approval resolution ──────────────────────────────────────

export async function findApprovalById(
  approvalId: string
): Promise<{ row: Record<string, string>; rowIndex: number; headers: string[]; spreadsheetId: string } | null> {
  const spreadsheetId = process.env.SHEETS_TRANSACTIONS_ID;
  if (!spreadsheetId || !useRealSheets()) {
    const rows = memStore.get('approval_requests') ?? [];
    const idx = rows.findIndex((r) => String(r.approval_id ?? r.id) === approvalId);
    if (idx < 0) return null;
    return {
      row: rows[idx] as Record<string, string>,
      rowIndex: idx,
      headers: Object.keys(rows[idx]),
      spreadsheetId: 'mem',
    };
  }
  try {
    const { headers, rows } = await readSheet(spreadsheetId, 'approval_requests');
    const idx = rows.findIndex((r) => r.approval_id === approvalId);
    if (idx < 0) return null;
    return { row: rows[idx], rowIndex: idx, headers, spreadsheetId };
  } catch {
    return null;
  }
}

export async function updateApprovalRow(
  spreadsheetId: string,
  rowIndex: number,
  headers: string[],
  updates: Record<string, unknown>
): Promise<void> {
  if (spreadsheetId === 'mem') {
    const rows = memStore.get('approval_requests') ?? [];
    rows[rowIndex] = { ...rows[rowIndex], ...updates };
    memStore.set('approval_requests', rows);
    return;
  }
  await updateRow(spreadsheetId, 'approval_requests', headers, rowIndex, updates);
}

// Legacy export so existing in-memory callers still work
export function listSheetTable(table: string): Array<Record<string, unknown>> {
  return memStore.get(table) ?? [];
}

/** Pending approval rows for dashboards (newest first). */
export async function listPendingApprovals(limit = 10): Promise<Record<string, string>[]> {
  const cap = Math.max(1, Math.min(100, limit));
  if (!useRealSheets() || !process.env.SHEETS_TRANSACTIONS_ID) {
    const rows = memStore.get('approval_requests') ?? [];
    const pending = rows.filter(
      (r) => String(r.status ?? 'PENDING').toUpperCase() === 'PENDING'
    );
    return pending.slice(-cap).reverse().map((r) => {
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(r)) o[k] = String(v ?? '');
      return o;
    });
  }
  try {
    const { rows } = await readSheet(process.env.SHEETS_TRANSACTIONS_ID, 'approval_requests');
    const pending = rows.filter(
      (r) => (r.status ?? 'PENDING').toUpperCase() === 'PENDING'
    );
    return pending.slice(-cap).reverse();
  } catch {
    return [];
  }
}
