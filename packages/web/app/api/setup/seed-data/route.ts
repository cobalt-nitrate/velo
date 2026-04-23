/**
 * POST /api/setup/seed-data
 *
 * Loads demo rows from data/mock/velo-demo-seed.json directly into PostgreSQL.
 * Idempotent by default — returns 409 if already seeded unless { force: true }.
 *
 * Security: Founder session required.
 */

import { authOptions } from '@/lib/auth';
import { applyStoredConnectorEnvAtStartup } from '@/lib/connector-env-store';
import { getOnboardingState, patchOnboardingState } from '@/lib/onboarding-store';
import { prisma } from '@/lib/prisma';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SeedTable {
  envKey: string; // kept for backward compat — ignored (we go to Postgres now)
  sheet: string;  // matches the Prisma @@map table name
  headers: string[];
  rows: Record<string, unknown>[];
}

// ─── Mapping: seed sheet name → Prisma model accessor name ───────────────────

const SHEET_TO_MODEL: Record<string, string> = {
  company_settings: 'companySetting',
  tax_rates: 'taxRate',
  expense_categories: 'expenseCategory',
  payroll_components: 'payrollComponent',
  leave_types: 'leaveType',
  compliance_rules: 'complianceRule',
  employees: 'employee',
  salary_structures: 'salaryStructure',
  vendor_master: 'vendor',
  client_master: 'client',
  bank_payees: 'bankPayee',
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
  gst_input_ledger: 'gstInputLedger',
  gst_output_ledger: 'gstOutputLedger',
  compliance_calendar: 'complianceCalendar',
  tax_obligations: 'taxObligation',
  tds_records: 'tdsRecord',
  filing_history: 'filingHistory',
  audit_trail: 'auditTrailEntry',
  chat_log: 'chatLog',
  agent_run_log: 'agentRunLog',
  policy_decisions: 'policyDecision',
  policy_documents: 'policyDocument',
  notification_log: 'notificationLog',
  file_links: 'fileLink',
};

// snake_case → camelCase conversion for building Prisma data objects
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function rowToData(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v !== null && v !== undefined ? String(v) : '';
  }
  return out;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // 1. Auth — founder only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if ((session.user as { actor_role?: string }).actor_role !== 'founder') {
      return NextResponse.json({ ok: false, error: 'Forbidden — founder role required' }, { status: 403 });
    }

    applyStoredConnectorEnvAtStartup();
    const state = await getOnboardingState();

    // 2. Parse optional force flag
    let force = false;
    try {
      const body = (await req.json()) as { force?: boolean };
      force = body.force === true;
    } catch { /* body optional */ }

    if (state.seedDataLoaded && !force) {
      return NextResponse.json(
        { ok: false, error: 'Demo data already loaded. Pass { force: true } to re-seed.' },
        { status: 409 }
      );
    }

    // 3. Load seed file
    const seedPath = join(process.cwd(), '..', '..', 'data', 'mock', 'velo-demo-seed.json');
    if (!existsSync(seedPath)) {
      return NextResponse.json(
        { ok: false, error: 'Demo seed file not found at data/mock/velo-demo-seed.json.' },
        { status: 422 }
      );
    }

    const raw = JSON.parse(readFileSync(seedPath, 'utf-8')) as { tables?: SeedTable[] };
    const tables = raw.tables;
    if (!Array.isArray(tables)) {
      return NextResponse.json({ ok: false, error: 'Invalid seed file format.' }, { status: 422 });
    }

    // 4. Insert each table into Postgres
    const results: { sheet: string; rows: number; skipped?: string }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as unknown as Record<string, any>;

    for (const t of tables) {
      const { sheet, rows } = t;
      if (!sheet || !Array.isArray(rows) || rows.length === 0) continue;

      const modelName = SHEET_TO_MODEL[sheet];
      if (!modelName) {
        results.push({ sheet, rows: 0, skipped: 'no Postgres model mapping' });
        continue;
      }

      const model = db[modelName];
      if (!model?.createMany) {
        results.push({ sheet, rows: 0, skipped: 'model not found in Prisma client' });
        continue;
      }

      try {
        if (force) {
          // On force re-seed, delete existing rows for idempotency
          await model.deleteMany({});
        }
        const data = rows.map((r) => rowToData(r));
        await model.createMany({ data, skipDuplicates: true });
        results.push({ sheet, rows: rows.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ sheet, rows: 0, skipped: msg });
      }
    }

    await patchOnboardingState({ seedDataLoaded: true });

    return NextResponse.json({
      ok: true,
      seeded: results.filter((r) => !r.skipped),
      warnings: results.filter((r) => r.skipped).map((r) => `${r.sheet}: ${r.skipped}`),
      totalRows: results.reduce((s, r) => s + r.rows, 0),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
