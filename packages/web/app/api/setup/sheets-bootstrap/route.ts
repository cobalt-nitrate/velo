/**
 * POST /api/setup/sheets-bootstrap
 *
 * Creates all 5 Velo Google Sheets workbooks with tabs and header rows.
 * Idempotent: skips creation for any spreadsheet whose env ID is already set.
 * Saves newly created IDs back to .velo/connector-env.json.
 *
 * Security:
 *  - Founder session required.
 *  - Google credentials must already be stored (validated before any API call).
 *  - bootstrapInProgress flag prevents concurrent runs.
 *  - 600 ms pause between spreadsheet creates to respect Sheets quota.
 *  - Sheet IDs from Google are opaque and never echoed from user input.
 */

import { authOptions } from '@/lib/auth';
import {
  applyStoredConnectorEnvAtStartup,
  patchStoredConnectorEnv,
} from '@/lib/connector-env-store';
import {
  getOnboardingState,
  patchOnboardingState,
} from '@/lib/onboarding-store';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Increase timeout — creating 5 spreadsheets takes time under quota.
export const maxDuration = 120;

// ─── Sheet manifest (mirrors scripts/setup-sheets-run.js) ────────────────────

const SPREADSHEETS = [
  {
    envKey: 'SHEETS_CONFIG_ID' as const,
    title: 'VELO_CONFIG',
    sheets: [
      { title: 'company_settings', headers: ['key', 'value', 'description', 'last_updated'] },
      { title: 'tax_rates', headers: ['type', 'subtype', 'rate_pct', 'state_code', 'salary_min', 'salary_max', 'notes'] },
      { title: 'expense_categories', headers: ['category_id', 'label', 'gst_rate', 'itc_claimable', 'itc_block_reason', 'parent_category'] },
      { title: 'payroll_components', headers: ['component_id', 'label', 'type', 'pct_of_ctc', 'pct_of_basic', 'taxable', 'pf_applicable', 'notes'] },
      { title: 'leave_types', headers: ['leave_type_id', 'label', 'annual_entitlement_days', 'carry_forward_max', 'encashable', 'paid', 'accrual', 'notes'] },
      { title: 'compliance_rules', headers: ['rule_id', 'label', 'frequency', 'due_day_of_month', 'applicable_months', 'applicable_states', 'portal', 'penalty_notes'] },
    ],
  },
  {
    envKey: 'SHEETS_MASTER_ID' as const,
    title: 'VELO_MASTER',
    sheets: [
      { title: 'employees', headers: ['employee_id', 'full_name', 'email', 'personal_email', 'phone', 'dob', 'gender', 'pan', 'aadhaar', 'address', 'designation', 'department', 'reports_to', 'doj', 'doe', 'status', 'employment_type', 'salary_structure_id', 'ctc_annual_inr', 'pf_uan', 'esic_ip_number', 'pt_applicable', 'tds_regime', 'bank_account_number', 'bank_ifsc', 'bank_name', 'created_at', 'updated_at'] },
      { title: 'salary_structures', headers: ['structure_id', 'label', 'description', 'basic_pct_of_ctc', 'hra_pct_of_basic', 'lta_pct_of_ctc', 'special_allowance_residual', 'effective_from', 'created_at'] },
      { title: 'vendor_master', headers: ['vendor_id', 'vendor_name', 'gstin', 'pan', 'bank_account', 'ifsc', 'bank_name', 'payment_terms_days', 'is_payee_added', 'contact_email', 'contact_phone', 'created_at', 'updated_at'] },
      { title: 'client_master', headers: ['client_id', 'client_name', 'gstin', 'pan', 'billing_address', 'state', 'contact_email', 'contact_phone', 'payment_terms_days', 'created_at', 'updated_at'] },
      { title: 'bank_payees', headers: ['payee_id', 'vendor_id', 'vendor_name', 'bank_account', 'ifsc', 'bank_name', 'added_date', 'status', 'notes'] },
    ],
  },
  {
    envKey: 'SHEETS_TRANSACTIONS_ID' as const,
    title: 'VELO_TRANSACTIONS',
    sheets: [
      { title: 'payroll_runs', headers: ['run_id', 'month', 'year', 'employee_count', 'total_gross', 'total_deductions', 'total_net', 'pf_employer_total', 'esic_employer_total', 'status', 'approved_by', 'approved_at', 'created_at'] },
      { title: 'salary_slips', headers: ['slip_id', 'run_id', 'employee_id', 'employee_name', 'month', 'year', 'basic', 'hra', 'lta', 'special_allowance', 'gross_salary', 'pf_employee', 'esic_employee', 'pt', 'tds', 'lop_deduction', 'total_deductions', 'net_salary', 'working_days', 'lop_days', 'drive_url', 'created_at'] },
      { title: 'ap_invoices', headers: ['invoice_id', 'vendor_id', 'vendor_name', 'invoice_number', 'invoice_date', 'due_date', 'line_items_json', 'subtotal', 'gst_amount', 'total_amount', 'expense_category', 'sub_category', 'itc_claimable', 'itc_amount', 'payment_status', 'payment_date', 'bank_reference', 'approver', 'approved_at', 'source_file_url', 'notes', 'created_at'] },
      { title: 'ar_invoices', headers: ['invoice_id', 'client_id', 'client_name', 'invoice_number', 'invoice_date', 'due_date', 'service_description', 'subtotal', 'igst', 'cgst', 'sgst', 'total_amount', 'status', 'payment_received_date', 'bank_reference', 'followup_count', 'last_followup_date', 'invoice_pdf_url', 'created_at'] },
      { title: 'expense_entries', headers: ['entry_id', 'date', 'source_ap_invoice_id', 'vendor_name', 'category', 'sub_category', 'amount', 'gst_amount', 'gst_rate', 'itc_claimable', 'itc_amount', 'notes', 'created_at'] },
      { title: 'leave_records', headers: ['record_id', 'employee_id', 'employee_name', 'leave_type', 'from_date', 'to_date', 'days', 'reason', 'status', 'approver', 'approved_at', 'created_at'] },
      { title: 'leave_balances', headers: ['balance_id', 'employee_id', 'leave_type', 'year', 'opening_balance', 'accrued', 'used', 'closing_balance', 'last_updated'] },
      { title: 'attendance', headers: ['record_id', 'employee_id', 'month', 'year', 'working_days_in_month', 'days_present', 'days_absent', 'lop_days', 'wfh_days', 'updated_at'] },
      { title: 'approval_requests', headers: ['approval_id', 'agent_id', 'action_type', 'action_payload_json', 'confidence_score', 'evidence_json', 'proposed_action_text', 'created_at', 'expires_at', 'status', 'approver_role', 'resolved_by', 'resolved_at', 'resolution_notes', 'attachment_drive_urls_json'] },
      { title: 'hr_tasks', headers: ['task_id', 'employee_id', 'task_type', 'description', 'due_date', 'status', 'completed_at', 'notes', 'primary_drive_url', 'primary_drive_file_id'] },
      { title: 'bank_transactions', headers: ['txn_id', 'company_id', 'date', 'narration', 'ref_number', 'amount', 'balance', 'type', 'mode', 'source', 'created_at'] },
    ],
  },
  {
    envKey: 'SHEETS_COMPLIANCE_ID' as const,
    title: 'VELO_COMPLIANCE',
    sheets: [
      { title: 'tax_obligations', headers: ['obligation_id', 'type', 'period_month', 'period_year', 'due_date', 'amount_inr', 'status', 'paid_date', 'payment_reference', 'payroll_run_id', 'created_at'] },
      { title: 'gst_input_ledger', headers: ['ledger_id', 'ap_invoice_id', 'vendor_name', 'invoice_date', 'period_month', 'period_year', 'invoice_amount', 'gst_amount', 'gst_rate', 'itc_claimable', 'itc_claimed', 'itc_amount', 'category', 'created_at'] },
      { title: 'gst_output_ledger', headers: ['ledger_id', 'ar_invoice_id', 'client_name', 'invoice_date', 'period_month', 'period_year', 'taxable_amount', 'igst', 'cgst', 'sgst', 'total_gst', 'created_at'] },
      { title: 'compliance_calendar', headers: ['calendar_id', 'type', 'label', 'period_month', 'period_year', 'due_date', 'status', 'alert_sent_7d', 'alert_sent_2d', 'completed_date', 'filing_reference', 'notes'] },
      { title: 'tds_records', headers: ['record_id', 'employee_id', 'employee_name', 'period_month', 'period_year', 'taxable_income_ytd', 'tds_deducted', 'tds_deposited', 'quarter', 'challan_reference', 'created_at'] },
      { title: 'filing_history', headers: ['filing_id', 'type', 'period', 'filed_date', 'acknowledgement_number', 'filed_by', 'status', 'notes'] },
    ],
  },
  {
    envKey: 'SHEETS_LOGS_ID' as const,
    title: 'VELO_LOGS',
    sheets: [
      { title: 'audit_trail', headers: ['entry_id', 'timestamp', 'actor_id', 'actor_role', 'agent_id', 'action_type', 'module', 'record_id', 'old_value_json', 'new_value_json', 'status', 'session_id'] },
      { title: 'chat_log', headers: ['log_id', 'timestamp', 'session_id', 'actor_id', 'actor_role', 'user_message', 'ai_response', 'agent_routed_to', 'action_taken', 'action_status'] },
      { title: 'agent_run_log', headers: ['run_id', 'timestamp', 'agent_id', 'session_id', 'input_json', 'output_json', 'iterations', 'status', 'confidence_score', 'policy_result', 'duration_ms'] },
      { title: 'policy_decisions', headers: ['decision_id', 'timestamp', 'agent_id', 'action_type', 'confidence_score', 'actor_role', 'policy_result', 'override_applied', 'notes'] },
      { title: 'policy_documents', headers: ['doc_id', 'doc_type', 'version', 'generated_at', 'generated_by', 'content_markdown', 'gdrive_url'] },
      { title: 'notification_log', headers: ['notification_id', 'timestamp', 'type', 'channel', 'recipient', 'subject', 'status', 'related_record_id'] },
      { title: 'file_links', headers: ['link_id', 'scope_table', 'scope_record_id', 'role', 'drive_file_id', 'drive_web_view_url', 'mime', 'filename', 'local_upload_id', 'source', 'meta_json', 'created_at'] },
    ],
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
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

    // 2. Concurrent-run guard
    applyStoredConnectorEnvAtStartup();
    const state = await getOnboardingState();
    if (state.bootstrapInProgress) {
      return NextResponse.json(
        { ok: false, error: 'Bootstrap already in progress — wait for it to finish.' },
        { status: 409 }
      );
    }

    // 3. Validate Google credentials are available
    const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY?.trim();
    if (!saEmail || !privateKeyRaw) {
      return NextResponse.json(
        { ok: false, error: 'Google service account credentials not configured. Save them in the Google Sheets connector first.' },
        { status: 422 }
      );
    }
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    // 4. Parse optional force flag from body
    let force = false;
    try {
      const body = (await req.json()) as { force?: boolean };
      force = body.force === true;
    } catch {
      /* body is optional */
    }

    await patchOnboardingState({ bootstrapInProgress: true });

    // 5. Auth client
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: saEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheetsClient = google.sheets({ version: 'v4', auth });

    const createdIds: Record<string, string> = {};
    const skipped: string[] = [];
    const created: string[] = [];

    // 6. Idempotent create loop
    for (const sp of SPREADSHEETS) {
      const existingId = process.env[sp.envKey]?.trim();
      if (existingId && !force) {
        skipped.push(sp.envKey);
        continue;
      }

      // Create spreadsheet
      const res = await sheetsClient.spreadsheets.create({
        requestBody: {
          properties: { title: sp.title },
          sheets: sp.sheets.map((s, i) => ({
            properties: {
              sheetId: i,
              title: s.title,
              gridProperties: { rowCount: 1000, columnCount: s.headers.length },
            },
          })),
        },
      });
      const spreadsheetId = res.data.spreadsheetId!;

      // Write header rows in a single batchUpdate
      await sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: sp.sheets.map((s) => ({
            range: `${s.title}!A1:${columnLetter(s.headers.length)}1`,
            // Spread to convert readonly tuple → mutable string[]
            values: [[...s.headers]],
          })),
        },
      });

      // Freeze header row on every sheet
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: sp.sheets.map((_, i) => ({
            updateSheetProperties: {
              properties: { sheetId: i, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          })),
        },
      });

      createdIds[sp.envKey] = spreadsheetId;
      created.push(sp.envKey);

      // Respect Sheets quota: 60 requests/min
      await sleep(600);
    }

    // 7. Persist new IDs to connector store (empty patch = no-op if nothing created)
    if (Object.keys(createdIds).length > 0) {
      patchStoredConnectorEnv(createdIds);
    }

    // 8. Mark bootstrap complete
    await patchOnboardingState({
      bootstrapInProgress: false,
      sheetsBootstrapped: true,
      steps: { google: { done: true } } as OnboardingState['steps'],
    });

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      ids: Object.fromEntries(
        Object.entries(createdIds).map(([k, v]) => [
          k,
          // Return just enough to confirm (first 8 chars) — full ID not sensitive but no need to echo
          `${v.slice(0, 8)}…`,
        ])
      ),
    });
  } catch (e) {
    await patchOnboardingState({ bootstrapInProgress: false });
    const message = e instanceof Error ? e.message : String(e);
    const isQuota = /quota|429|RESOURCE_EXHAUSTED/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        error: isQuota
          ? 'Google Sheets quota exceeded. Wait 60 seconds and try again.'
          : message,
      },
      { status: isQuota ? 429 : 500 }
    );
  }
}

// Needed to satisfy TS — SPREADSHEETS uses `as const` so steps type must be imported
type OnboardingState = import('@/lib/onboarding-store').OnboardingState;
