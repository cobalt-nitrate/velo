// One-time Google Sheets setup script.
// Creates all 5 Velo spreadsheets with every tab and header row.
// Shares each spreadsheet with the founder's Google account.
// Run with: node scripts/setup-sheets-run.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const OWNER_EMAIL = 'hharshit12@gmail.com';
const KEY_FILE = path.join(__dirname, '..', 'velo-sa-key.json');

// Uses Application Default Credentials (gcloud auth application-default login).
// ADC is configured to impersonate velo-sa with Drive + Sheets scopes.
const auth = new google.auth.GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

// ─── Sheet Definitions ───────────────────────────────────────────────────────
// Each spreadsheet: { title, sheets: [{ title, headers[] }] }

const SPREADSHEETS = [
  {
    key: 'CONFIG',
    title: 'VELO_CONFIG',
    description: 'Business rules — read-only config for all agents',
    sheets: [
      {
        title: 'company_settings',
        headers: ['key', 'value', 'description', 'last_updated'],
      },
      {
        title: 'tax_rates',
        headers: ['type', 'subtype', 'rate_pct', 'state_code', 'salary_min', 'salary_max', 'notes'],
      },
      {
        title: 'expense_categories',
        headers: ['category_id', 'label', 'gst_rate', 'itc_claimable', 'itc_block_reason', 'parent_category'],
      },
      {
        title: 'payroll_components',
        headers: ['component_id', 'label', 'type', 'pct_of_ctc', 'pct_of_basic', 'taxable', 'pf_applicable', 'notes'],
      },
      {
        title: 'leave_types',
        headers: ['leave_type_id', 'label', 'annual_entitlement_days', 'carry_forward_max', 'encashable', 'paid', 'accrual', 'notes'],
      },
      {
        title: 'compliance_rules',
        headers: ['rule_id', 'label', 'frequency', 'due_day_of_month', 'applicable_months', 'applicable_states', 'portal', 'penalty_notes'],
      },
    ],
  },
  {
    key: 'MASTER',
    title: 'VELO_MASTER',
    description: 'Master reference data — employees, vendors, clients',
    sheets: [
      {
        title: 'employees',
        headers: [
          'employee_id', 'full_name', 'email', 'personal_email', 'phone', 'dob', 'gender',
          'pan', 'aadhaar', 'address', 'designation', 'department', 'reports_to',
          'doj', 'doe', 'status', 'employment_type', 'salary_structure_id',
          'ctc_annual_inr', 'pf_uan', 'esic_ip_number', 'pt_applicable', 'tds_regime',
          'bank_account_number', 'bank_ifsc', 'bank_name', 'created_at', 'updated_at',
        ],
      },
      {
        title: 'salary_structures',
        headers: [
          'structure_id', 'label', 'description',
          'basic_pct_of_ctc', 'hra_pct_of_basic', 'lta_pct_of_ctc',
          'special_allowance_residual', 'effective_from', 'created_at',
        ],
      },
      {
        title: 'vendor_master',
        headers: [
          'vendor_id', 'vendor_name', 'gstin', 'pan',
          'bank_account', 'ifsc', 'bank_name',
          'payment_terms_days', 'is_payee_added',
          'contact_email', 'contact_phone', 'created_at', 'updated_at',
        ],
      },
      {
        title: 'client_master',
        headers: [
          'client_id', 'client_name', 'gstin', 'pan',
          'billing_address', 'state', 'contact_email', 'contact_phone',
          'payment_terms_days', 'created_at', 'updated_at',
        ],
      },
      {
        title: 'bank_payees',
        headers: [
          'payee_id', 'vendor_id', 'vendor_name',
          'bank_account', 'ifsc', 'bank_name',
          'added_date', 'status', 'notes',
        ],
      },
    ],
  },
  {
    key: 'TRANSACTIONS',
    title: 'VELO_TRANSACTIONS',
    description: 'All transactional data — payroll, invoices, leaves, approvals',
    sheets: [
      {
        title: 'payroll_runs',
        headers: [
          'run_id', 'month', 'year', 'employee_count',
          'total_gross', 'total_deductions', 'total_net',
          'pf_employer_total', 'esic_employer_total',
          'status', 'approved_by', 'approved_at', 'created_at',
        ],
      },
      {
        title: 'salary_slips',
        headers: [
          'slip_id', 'run_id', 'employee_id', 'employee_name', 'month', 'year',
          'basic', 'hra', 'lta', 'special_allowance', 'gross_salary',
          'pf_employee', 'esic_employee', 'pt', 'tds', 'lop_deduction',
          'total_deductions', 'net_salary',
          'working_days', 'lop_days', 'drive_url', 'created_at',
        ],
      },
      {
        title: 'ap_invoices',
        headers: [
          'invoice_id', 'vendor_id', 'vendor_name', 'invoice_number', 'invoice_date', 'due_date',
          'line_items_json', 'subtotal', 'gst_amount', 'total_amount',
          'expense_category', 'sub_category', 'itc_claimable', 'itc_amount',
          'payment_status', 'payment_date', 'bank_reference',
          'approver', 'approved_at', 'source_file_url', 'notes', 'created_at',
        ],
      },
      {
        title: 'ar_invoices',
        headers: [
          'invoice_id', 'client_id', 'client_name', 'invoice_number', 'invoice_date', 'due_date',
          'service_description', 'subtotal', 'igst', 'cgst', 'sgst', 'total_amount',
          'status', 'payment_received_date', 'bank_reference',
          'followup_count', 'last_followup_date', 'invoice_pdf_url', 'created_at',
        ],
      },
      {
        title: 'expense_entries',
        headers: [
          'entry_id', 'date', 'source_ap_invoice_id', 'vendor_name',
          'category', 'sub_category', 'amount', 'gst_amount', 'gst_rate',
          'itc_claimable', 'itc_amount', 'notes', 'created_at',
        ],
      },
      {
        title: 'leave_records',
        headers: [
          'record_id', 'employee_id', 'employee_name', 'leave_type',
          'from_date', 'to_date', 'days', 'reason',
          'status', 'approver', 'approved_at', 'created_at',
        ],
      },
      {
        title: 'leave_balances',
        headers: [
          'balance_id', 'employee_id', 'leave_type', 'year',
          'opening_balance', 'accrued', 'used', 'closing_balance', 'last_updated',
        ],
      },
      {
        title: 'attendance',
        headers: [
          'record_id', 'employee_id', 'month', 'year',
          'working_days_in_month', 'days_present', 'days_absent',
          'lop_days', 'wfh_days', 'updated_at',
        ],
      },
      {
        title: 'approval_requests',
        headers: [
          'approval_id', 'agent_id', 'action_type', 'action_payload_json',
          'confidence_score', 'evidence_json', 'proposed_action_text',
          'created_at', 'expires_at', 'status',
          'approver_role', 'resolved_by', 'resolved_at', 'resolution_notes',
        ],
      },
      {
        title: 'hr_tasks',
        headers: [
          'task_id', 'employee_id', 'task_type', 'description',
          'due_date', 'status', 'completed_at', 'notes',
        ],
      },
    ],
  },
  {
    key: 'COMPLIANCE',
    title: 'VELO_COMPLIANCE',
    description: 'Compliance tracking — obligations, GST ledgers, TDS, filings',
    sheets: [
      {
        title: 'tax_obligations',
        headers: [
          'obligation_id', 'type', 'period_month', 'period_year', 'due_date',
          'amount_inr', 'status', 'paid_date', 'payment_reference',
          'payroll_run_id', 'created_at',
        ],
      },
      {
        title: 'gst_input_ledger',
        headers: [
          'ledger_id', 'ap_invoice_id', 'vendor_name', 'invoice_date',
          'period_month', 'period_year',
          'invoice_amount', 'gst_amount', 'gst_rate',
          'itc_claimable', 'itc_claimed', 'itc_amount',
          'category', 'created_at',
        ],
      },
      {
        title: 'gst_output_ledger',
        headers: [
          'ledger_id', 'ar_invoice_id', 'client_name', 'invoice_date',
          'period_month', 'period_year',
          'taxable_amount', 'igst', 'cgst', 'sgst', 'total_gst', 'created_at',
        ],
      },
      {
        title: 'compliance_calendar',
        headers: [
          'calendar_id', 'type', 'label', 'period_month', 'period_year', 'due_date',
          'status', 'alert_sent_7d', 'alert_sent_2d',
          'completed_date', 'filing_reference', 'notes',
        ],
      },
      {
        title: 'tds_records',
        headers: [
          'record_id', 'employee_id', 'employee_name',
          'period_month', 'period_year',
          'taxable_income_ytd', 'tds_deducted', 'tds_deposited',
          'quarter', 'challan_reference', 'created_at',
        ],
      },
      {
        title: 'filing_history',
        headers: [
          'filing_id', 'type', 'period', 'filed_date',
          'acknowledgement_number', 'filed_by', 'status', 'notes',
        ],
      },
    ],
  },
  {
    key: 'LOGS',
    title: 'VELO_LOGS',
    description: 'Immutable logs — audit trail, chat, agent runs, notifications',
    sheets: [
      {
        title: 'audit_trail',
        headers: [
          'entry_id', 'timestamp', 'actor_id', 'actor_role', 'agent_id',
          'action_type', 'module', 'record_id',
          'old_value_json', 'new_value_json', 'status', 'session_id',
        ],
      },
      {
        title: 'chat_log',
        headers: [
          'log_id', 'timestamp', 'session_id', 'actor_id', 'actor_role',
          'user_message', 'ai_response', 'agent_routed_to', 'action_taken', 'action_status',
        ],
      },
      {
        title: 'agent_run_log',
        headers: [
          'run_id', 'timestamp', 'agent_id', 'session_id',
          'input_json', 'output_json', 'iterations',
          'status', 'confidence_score', 'policy_result', 'duration_ms',
        ],
      },
      {
        title: 'policy_decisions',
        headers: [
          'decision_id', 'timestamp', 'agent_id', 'action_type',
          'confidence_score', 'actor_role', 'policy_result',
          'override_applied', 'notes',
        ],
      },
      {
        title: 'policy_documents',
        headers: [
          'doc_id', 'doc_type', 'version', 'generated_at',
          'generated_by', 'content_markdown', 'gdrive_url',
        ],
      },
      {
        title: 'notification_log',
        headers: [
          'notification_id', 'timestamp', 'type', 'channel',
          'recipient', 'subject', 'status', 'related_record_id',
        ],
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VELO_DATA_FOLDER_ID = '1b526Cgd8_AYDa1KimK6Hw0wRTAPuwzTc';

async function createSpreadsheet(sheets, drive, title, sheetDefs) {
  // Step 1: Create the spreadsheet
  const resource = {
    properties: { title },
    sheets: sheetDefs.map((s, i) => ({
      properties: {
        sheetId: i,
        title: s.title,
        gridProperties: { rowCount: 1000, columnCount: s.headers.length },
      },
    })),
  };
  const res = await sheets.spreadsheets.create({ resource });
  const spreadsheetId = res.data.spreadsheetId;

  // Step 2: Move into the Velo Data folder (add parent, remove default parent)
  const meta = await drive.files.get({ fileId: spreadsheetId, fields: 'parents' });
  const oldParents = (meta.data.parents || []).join(',');
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: VELO_DATA_FOLDER_ID,
    removeParents: oldParents,
    fields: 'id, parents',
  });

  return res.data;
}

async function writeHeaders(sheets, spreadsheetId, sheetDefs) {
  const data = sheetDefs.map((s) => ({
    range: `${s.title}!A1:${columnLetter(s.headers.length)}1`,
    values: [s.headers],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: { valueInputOption: 'RAW', data },
  });
}

async function formatHeaders(sheets, spreadsheetId, sheetDefs) {
  const requests = sheetDefs.map((_s, i) => ({
    repeatCell: {
      range: { sheetId: i, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.18, green: 0.18, blue: 0.18 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          horizontalAlignment: 'LEFT',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  }));

  // Freeze header row on each sheet
  const freezeRequests = sheetDefs.map((_, i) => ({
    updateSheetProperties: {
      properties: { sheetId: i, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests: [...requests, ...freezeRequests] },
  });
}


function columnLetter(n) {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const authClient = await auth.getClient();
  const sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  const driveClient = google.drive({ version: 'v3', auth: authClient });

  const results = {};

  for (const sp of SPREADSHEETS) {
    process.stdout.write(`Creating ${sp.title}... `);

    const spreadsheet = await createSpreadsheet(sheetsClient, driveClient, sp.title, sp.sheets);
    const id = spreadsheet.spreadsheetId;

    await writeHeaders(sheetsClient, id, sp.sheets);
    await formatHeaders(sheetsClient, id, sp.sheets);

    // Share with service account so the Velo app can read/write at runtime
    await driveClient.permissions.create({
      fileId: id,
      resource: {
        type: 'user',
        role: 'writer',
        emailAddress: 'velo-sa@velo-backops.iam.gserviceaccount.com',
      },
      sendNotificationEmail: false,
    });

    results[sp.key] = id;
    console.log(`✓  https://docs.google.com/spreadsheets/d/${id}`);
    await sleep(500); // brief pause between creates to avoid rate limits
  }

  // ── Write .env.local ───────────────────────────────────────────────────────
  const keyJson = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  const privateKeyEscaped = keyJson.private_key.replace(/\n/g, '\\n');

  const envContent = `# Auto-generated by setup-sheets-run.js — do not commit
# Generated: ${new Date().toISOString()}

ANTHROPIC_API_KEY=your_anthropic_api_key_here

GOOGLE_SERVICE_ACCOUNT_EMAIL=${keyJson.client_email}
GOOGLE_PRIVATE_KEY="${privateKeyEscaped}"
GOOGLE_PROJECT_ID=${keyJson.project_id}

SHEETS_CONFIG_ID=${results.CONFIG}
SHEETS_MASTER_ID=${results.MASTER}
SHEETS_TRANSACTIONS_ID=${results.TRANSACTIONS}
SHEETS_COMPLIANCE_ID=${results.COMPLIANCE}
SHEETS_LOGS_ID=${results.LOGS}

NEXTAUTH_SECRET=change_this_to_a_random_32_char_string
NEXTAUTH_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
`;

  const envPath = path.join(__dirname, '..', '.env.local');
  fs.writeFileSync(envPath, envContent);
  console.log('\n.env.local written with all spreadsheet IDs.');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─── Setup Complete ───────────────────────────────────────────');
  console.log(`Service account: ${keyJson.client_email}`);
  console.log(`Shared with:     ${OWNER_EMAIL}`);
  console.log('\nSpreadsheet IDs:');
  for (const [key, id] of Object.entries(results)) {
    console.log(`  SHEETS_${key}_ID=${id}`);
  }
  console.log('\nAll sheets have headers set and rows frozen.');
  console.log('Add your ANTHROPIC_API_KEY to .env.local and you\'re ready to build.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
