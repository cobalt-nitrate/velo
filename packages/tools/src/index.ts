import type { ToolSchema } from '@velo/core/types';
import { executeSheetTool } from './sheets/client.js';
import { sendEmail } from './email/index.js';
import { sendNotification } from './notifications/index.js';
import {
  parseInvoiceText,
  ocrExtractFromPdf,
  ocrExtractFromImage,
  ocrExtractFromText,
} from './ocr/invoice-parser.js';
import { parseBankStatement } from './bank/statement-parser.js';
import { generatePdfDocument } from './documents/pdf-generator.js';
import { runPlatformHealthcheck } from './platform-health.js';

type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

export interface ToolDefinition {
  id: string;
  description: string;
  schema: ToolSchema['input_schema'];
  handler: ToolHandler;
}

// ─── Shared schemas ───────────────────────────────────────────────────────────

const COMMON_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    payload: { type: 'object' },
  },
};

const LOOKUP_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    vendor_name: { type: 'string' },
    gstin: { type: 'string' },
    employee_id: { type: 'string' },
    month: { type: 'string' },
    year: { type: 'string' },
    period_month: { type: 'string' },
    period_year: { type: 'string' },
    quarter: { type: 'string' },
    doc_type: { type: 'string' },
    days_ahead: { type: 'number' },
    from_date: { type: 'string' },
    to_date: { type: 'string' },
    limit: { type: 'number' },
  },
};

/** Wave 0 — explicit shapes for high-impact sheet writes (LLM tool registration). */
const AP_INVOICE_ROW_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    invoice_id: { type: 'string' },
    vendor_id: { type: 'string' },
    vendor_name: { type: 'string' },
    invoice_number: { type: 'string' },
    invoice_date: { type: 'string' },
    due_date: { type: 'string' },
    total_amount: { type: 'string' },
    subtotal: { type: 'string' },
    igst: { type: 'string' },
    cgst: { type: 'string' },
    sgst: { type: 'string' },
    payment_status: { type: 'string' },
    status: { type: 'string' },
    created_at: { type: 'string' },
  },
  required: ['vendor_name', 'total_amount', 'invoice_date'],
};

const AP_INVOICE_UPDATE_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    ...(AP_INVOICE_ROW_SCHEMA.properties as Record<string, unknown>),
  },
  required: ['invoice_id'],
};

const AR_INVOICE_ROW_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    invoice_id: { type: 'string' },
    client_id: { type: 'string' },
    client_name: { type: 'string' },
    invoice_number: { type: 'string' },
    invoice_date: { type: 'string' },
    due_date: { type: 'string' },
    service_description: { type: 'string' },
    subtotal: { type: 'string' },
    igst: { type: 'string' },
    cgst: { type: 'string' },
    sgst: { type: 'string' },
    total_amount: { type: 'string' },
    status: { type: 'string' },
    payment_received_date: { type: 'string' },
    bank_reference: { type: 'string' },
    followup_count: { type: 'string' },
    last_followup_date: { type: 'string' },
    invoice_pdf_url: { type: 'string' },
    created_at: { type: 'string' },
  },
  required: ['client_name', 'total_amount', 'invoice_date'],
};

const APPROVAL_REQUEST_ROW_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    approval_id: { type: 'string' },
    agent_id: { type: 'string' },
    action_type: { type: 'string' },
    action_payload_json: { type: 'string' },
    confidence_score: { type: 'string' },
    evidence_json: { type: 'string' },
    proposed_action_text: { type: 'string' },
    created_at: { type: 'string' },
    expires_at: { type: 'string' },
    status: { type: 'string' },
    approver_role: { type: 'string' },
    resolved_by: { type: 'string' },
    resolved_at: { type: 'string' },
    resolution_notes: { type: 'string' },
    attachment_drive_urls_json: { type: 'string' },
  },
  required: ['approval_id', 'agent_id', 'action_type', 'status'],
};

const VENDOR_CREATE_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    vendor_id: { type: 'string' },
    vendor_name: { type: 'string' },
    gstin: { type: 'string' },
    pan: { type: 'string' },
    address: { type: 'string' },
    created_at: { type: 'string' },
  },
  required: ['vendor_name'],
};

const GST_LEDGER_WRITE_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    ledger_id: { type: 'string' },
    invoice_id: { type: 'string' },
    vendor_name: { type: 'string' },
    client_name: { type: 'string' },
    invoice_date: { type: 'string' },
    period_month: { type: 'string' },
    period_year: { type: 'string' },
    taxable_amount: { type: 'string' },
    igst: { type: 'string' },
    cgst: { type: 'string' },
    sgst: { type: 'string' },
    total_gst: { type: 'string' },
    ar_invoice_id: { type: 'string' },
    created_at: { type: 'string' },
  },
  required: ['company_id'],
};

const EXPENSE_ENTRY_ROW_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    entry_id: { type: 'string' },
    category: { type: 'string' },
    amount_inr: { type: 'string' },
    expense_date: { type: 'string' },
    description: { type: 'string' },
    created_at: { type: 'string' },
  },
  required: ['amount_inr'],
};

const PAYROLL_RUN_CREATE_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    tool_id: { type: 'string' },
    run_id: { type: 'string' },
    month: { type: 'string' },
    year: { type: 'string' },
    status: { type: 'string' },
    total_gross: { type: 'string' },
    total_deductions: { type: 'string' },
    net_payable: { type: 'string' },
    created_at: { type: 'string' },
  },
  required: ['month', 'year'],
};

// ─── Tool definitions ─────────────────────────────────────────────────────────

const toolDefinitions: ToolDefinition[] = [
  // ── CONFIG (company_settings in Sheets) ─────────────────────────────────────
  {
    id: 'sheets.company_settings.lookup',
    description: 'Read company_settings key/value rows from CONFIG spreadsheet',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },

  // ── AP Invoice tools ────────────────────────────────────────────────────────
  {
    id: 'sheets.ap_invoices.create',
    description: 'Create AP invoice row in sheet',
    schema: AP_INVOICE_ROW_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ap_invoices.update',
    description: 'Update AP invoice row in sheet',
    schema: AP_INVOICE_UPDATE_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ap_invoices.find_by_vendor_amount_date',
    description: 'Find AP invoice matches by vendor, amount, date (duplicate detection)',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        vendor_id: { type: 'string' },
        vendor_name: { type: 'string' },
        total_amount: { type: 'number' },
        invoice_date: { type: 'string' },
        invoice_number: { type: 'string' },
      },
    },
    handler: executeSheetTool,
  },

  // ── Vendor master tools ──────────────────────────────────────────────────────
  {
    id: 'sheets.vendor_master.lookup_by_gstin',
    description: 'Lookup vendor using GSTIN (exact match)',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        gstin: { type: 'string', description: '15-char GSTIN of the vendor' },
      },
      required: ['gstin'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.vendor_master.lookup_by_name_fuzzy',
    description: 'Lookup vendor using fuzzy name matching',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        vendor_name: { type: 'string', description: 'Vendor name to search for' },
      },
      required: ['vendor_name'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.vendor_master.create',
    description: 'Create vendor in vendor master',
    schema: VENDOR_CREATE_SCHEMA,
    handler: executeSheetTool,
  },

  // ── GST and expense tools ────────────────────────────────────────────────────
  {
    id: 'sheets.gst_input_ledger.create',
    description: 'Create GST input ledger row (record ITC-claimable GST)',
    schema: GST_LEDGER_WRITE_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.gst_input_ledger.get_balance',
    description: 'Get ITC balance for a given period (month + year)',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.gst_output_ledger.create',
    description: 'Create GST output ledger row for AR invoice',
    schema: GST_LEDGER_WRITE_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.gst_output_ledger.get_by_period',
    description: 'Get output GST for a period',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.expense_entries.create',
    description: 'Create classified expense ledger row',
    schema: EXPENSE_ENTRY_ROW_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.expense_entries.get_by_period',
    description: 'Get expense entries for a period',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Approval tools ────────────────────────────────────────────────────────────
  {
    id: 'sheets.approval_requests.create',
    description: 'Create approval request entry in Sheets',
    schema: APPROVAL_REQUEST_ROW_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Bank payee ────────────────────────────────────────────────────────────────
  {
    id: 'sheets.bank_payees.lookup',
    description: 'Lookup bank payee details by vendor_id',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        vendor_id: { type: 'string' },
        vendor_name: { type: 'string' },
      },
    },
    handler: executeSheetTool,
  },

  // ── AR Invoice tools ──────────────────────────────────────────────────────────
  {
    id: 'sheets.ar_invoices.create',
    description: 'Create AR invoice record',
    schema: AR_INVOICE_ROW_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ar_invoices.update',
    description: 'Update AR invoice status / payment received',
    schema: {
      type: 'object',
      properties: {
        ...(AR_INVOICE_ROW_SCHEMA.properties as Record<string, unknown>),
      },
      required: ['invoice_id'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ar_invoices.update_status',
    description: 'Update AR invoice status (alias)',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        tool_id: { type: 'string' },
        invoice_id: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['invoice_id', 'status'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ar_invoices.get_by_period',
    description: 'Get AR invoices for a period',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ar_invoices.get_outstanding',
    description: 'Get all outstanding (unpaid) AR invoices',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ar_invoices.get_overdue',
    description: 'Get AR invoices past due date and unpaid',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ap_invoices.get_pending_payables',
    description: 'AP invoices not yet paid',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ar_invoices.get_pending_receivables',
    description: 'AR invoices with balance due',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Client master ────────────────────────────────────────────────────────────
  {
    id: 'sheets.client_master.lookup',
    description: 'Lookup client details by client_id or name',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Employee tools ────────────────────────────────────────────────────────────
  {
    id: 'sheets.employees.get_active',
    description: 'Get all active employees',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.employees.get_by_id',
    description: 'Get employee by employee_id',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        employee_id: { type: 'string' },
      },
      required: ['employee_id'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.employees.get_active_headcount',
    description: 'Count active employees',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.employees.get_own_salary_structure',
    description: 'Employee row joined with salary structure definition',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        employee_id: { type: 'string' },
      },
      required: ['employee_id'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.employees.get_own_record',
    description: 'Get the requesting employee\'s own profile',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        employee_id: { type: 'string' },
      },
      required: ['employee_id'],
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.employees.create',
    description: 'Create new employee record',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.employees.update',
    description: 'Update employee record',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Salary structures ─────────────────────────────────────────────────────────
  {
    id: 'sheets.salary_structures.get_by_id',
    description: 'Get salary structure by structure_id',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        structure_id: { type: 'string' },
      },
      required: ['structure_id'],
    },
    handler: executeSheetTool,
  },

  // ── Attendance & leave ────────────────────────────────────────────────────────
  {
    id: 'sheets.attendance.get_by_employee_month',
    description: 'Get attendance record for employee by month/year',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_records.get_by_employee',
    description: 'Get all leave history for an employee',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_records.get_by_employee_month',
    description: 'Get leave records for employee in a specific month',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_records.create',
    description: 'Create a new leave record',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_records.update_status',
    description: 'Approve or reject a leave record',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_balances.get_by_employee',
    description: 'Get leave balance by type for an employee',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_balances.create_batch',
    description: 'Initialize leave balances for a new employee',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.leave_balances.update',
    description: 'Update leave balance after approval/rejection',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Payroll tools ─────────────────────────────────────────────────────────────
  {
    id: 'sheets.payroll_runs.create',
    description: 'Create payroll run record',
    schema: PAYROLL_RUN_CREATE_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.payroll_runs.update_status',
    description: 'Update payroll run status (e.g., PENDING_APPROVAL → APPROVED)',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.payroll_runs.get_by_period',
    description: 'Get payroll run records for a period',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.payroll_runs.get_committed_salaries',
    description: 'Payroll runs in approved/committed/paid state',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.salary_slips.create_batch',
    description: 'Create salary slips for all employees in a payroll run',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.salary_slips.get_by_employee_month',
    description: 'Get salary slip for an employee for a specific month/year',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.salary_slips.get_ytd_by_employee',
    description: 'Year-to-date salary slips per employee',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Compliance tools ──────────────────────────────────────────────────────────
  {
    id: 'sheets.compliance_calendar.get_upcoming',
    description: 'Get upcoming compliance obligations (next N days)',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.compliance_calendar.get_upcoming_obligations',
    description: 'Alias for upcoming compliance obligations',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.compliance_calendar.mark_done',
    description: 'Mark a compliance obligation as completed',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tax_obligations.create',
    description: 'Create a tax obligation record',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tax_obligations.create_batch',
    description: 'Create multiple tax obligation records (PF, ESIC, TDS, PT)',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tax_obligations.get_by_period',
    description: 'Get tax obligations for a period',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tax_obligations.update',
    description: 'Update tax obligation status, paid_date, or payment_reference',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tds_records.create_batch',
    description: 'Create TDS records for all employees',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tds_records.get_by_quarter',
    description: 'Get TDS records for a quarter',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.tds_records.get_by_employee_year',
    description: 'TDS ledger rows for one employee and financial year period',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.filing_history.create',
    description: 'Record a completed statutory filing',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },

  // ── HR tools ──────────────────────────────────────────────────────────────────
  {
    id: 'sheets.hr_tasks.create',
    description: 'Create an HR onboarding/offboarding task',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.hr_tasks.create_batch',
    description: 'Create multiple HR tasks',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.hr_tasks.get_blockers',
    description: 'Tasks blocking onboarding or HR workflows',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.hr_tasks.get_pending_hires',
    description: 'Onboarding/hire tasks not completed',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.hr_tasks.update_status',
    description: 'Mark an HR task as completed',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.hr_tasks.update',
    description: 'Update HR task fields (e.g. primary Drive URL after document generation)',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.salary_slips.update',
    description: 'Update a salary slip row (e.g. drive_url after generating payslip HTML)',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.file_links.create',
    description: 'Record a Drive file in Velo file_links index (scope_table + scope_record_id + role)',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.file_links.get_by_scope',
    description: 'List file_links for a scope_table / scope_record_id (optional role)',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        scope_table: { type: 'string' },
        scope_record_id: { type: 'string' },
        role: { type: 'string' },
      },
    },
    handler: executeSheetTool,
  },
  {
    id: 'sheets.policy_documents.create',
    description: 'Create a policy document record',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.policy_documents.get_by_type',
    description: 'Get policy document by type (e.g., "wfh", "leave", "posh")',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },

  // ── Notification tools ────────────────────────────────────────────────────────
  {
    id: 'notifications.send_approval_request',
    description: 'Send approval request notification to approver',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        approver_role: { type: 'string' },
        approval_id: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        channel: { type: 'string', enum: ['slack', 'email', 'in_app'] },
      },
    },
    handler: sendNotification,
  },
  {
    id: 'notifications.send_compliance_alert',
    description: 'Send compliance deadline alert',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_digest',
    description: 'Send weekly/monthly compliance or AR digest',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_secure_link',
    description: 'Send secure download link to employee (payslip, etc.)',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        employee_id: { type: 'string' },
        email: { type: 'string' },
        link: { type: 'string' },
        document_type: { type: 'string' },
        expiry_hours: { type: 'number' },
      },
    },
    handler: sendNotification,
  },
  {
    id: 'notifications.send_ar_reminder',
    description: 'Send payment reminder to a client for an overdue AR invoice',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_offer_letter',
    description: 'Send offer letter to a candidate',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_onboarding_welcome',
    description: 'Send welcome email to new joiner',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_alert',
    description: 'Generic Slack alert (runway / ops)',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_onboarding_link',
    description: 'Slack DM with onboarding checklist link',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'notifications.send_leave_notification',
    description: 'Slack update on leave request to employee/manager HR channel',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },

  // ── Document / Drive tools ────────────────────────────────────────────────────
  {
    id: 'documents.drive.upload_invoice',
    description: 'Upload source invoice file to Google Drive',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },
  {
    id: 'documents.drive.generate_offer_letter',
    description: 'Generate offer letter PDF and upload to Drive',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },
  {
    id: 'documents.drive.generate_salary_slip',
    description: 'Generate salary slip PDF and upload to Drive',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },
  {
    id: 'documents.drive.generate_experience_certificate',
    description: 'Generate experience certificate PDF',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },
  {
    id: 'documents.drive.generate_relieving_letter',
    description: 'Generate relieving letter PDF',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },
  {
    id: 'documents.drive.generate_secure_link',
    description: 'Generate a time-limited secure Drive link for a document',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        file_id: { type: 'string' },
        expiry_hours: { type: 'number' },
      },
    },
    handler: generatePdfDocument,
  },
  {
    id: 'documents.pdf_generator.generate_invoice',
    description: 'Generate client-facing AR invoice HTML/PDF artifact',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },

  // ── Email tools ───────────────────────────────────────────────────────────────
  {
    id: 'email.send_invoice',
    description: 'Send AR invoice to client via email',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        to: { type: 'string' },
        subject: { type: 'string' },
        invoice_id: { type: 'string' },
        client_name: { type: 'string' },
        amount: { type: 'number' },
        due_date: { type: 'string' },
        pdf_url: { type: 'string' },
      },
    },
    handler: sendEmail,
  },
  {
    id: 'email.send_offer_letter',
    description: 'Email offer letter PDF link to candidate',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        to: { type: 'string' },
        candidate_name: { type: 'string' },
        role_title: { type: 'string' },
        pdf_url: { type: 'string' },
        join_date: { type: 'string' },
        subject: { type: 'string' },
      },
    },
    handler: sendEmail,
  },
  {
    id: 'email.send_followup',
    description: 'AR/collections follow-up email',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        to: { type: 'string' },
        client_name: { type: 'string' },
        invoice_id: { type: 'string' },
        amount: { type: 'number' },
        days_overdue: { type: 'number' },
        subject: { type: 'string' },
      },
    },
    handler: sendEmail,
  },

  // ── OCR and parsing ───────────────────────────────────────────────────────────
  {
    id: 'ocr.extract_from_pdf',
    description: 'Extract invoice fields from a PDF URL',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        file_url: { type: 'string' },
        pdf_url: { type: 'string' },
      },
    },
    handler: ocrExtractFromPdf,
  },
  {
    id: 'ocr.extract_from_image',
    description: 'Extract invoice fields from an image URL',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        file_url: { type: 'string' },
        image_url: { type: 'string' },
      },
    },
    handler: ocrExtractFromImage,
  },
  {
    id: 'ocr.extract_from_text',
    description: 'Extract invoice fields from raw pasted text',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        raw_text: { type: 'string' },
        text: { type: 'string' },
      },
    },
    handler: ocrExtractFromText,
  },
  {
    id: 'ocr.invoice.parse',
    description: 'Parse invoice text/image to extract structured fields',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string' },
        raw_text: { type: 'string', description: 'Raw OCR text from invoice' },
        file_url: { type: 'string', description: 'URL to invoice file (PDF or image)' },
      },
    },
    handler: parseInvoiceText,
  },
  {
    id: 'bank.statement.parse',
    description: 'Parse bank statement to extract transactions',
    schema: COMMON_SCHEMA,
    handler: parseBankStatement,
  },

  // ── Bank transactions (read-only for runway) ──────────────────────────────────
  {
    id: 'sheets.bank_transactions.get_recent',
    description: 'Get recent bank transactions for cash position',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.bank_transactions.get_latest_balance',
    description: 'Latest running balance from imported bank transactions',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.bank_transactions.get_by_date_range',
    description: 'Bank transactions between from_date and to_date (ISO)',
    schema: LOOKUP_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.bank_transactions.create',
    description: 'Append one parsed bank transaction row',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.bank_transactions.create_batch',
    description: 'Append many bank transaction rows (e.g. after statement parse)',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },

  {
    id: 'internal.platform.healthcheck',
    description:
      'Full Velo health: integration probes (Sheets IDs, Drive, LLM) plus operational_snapshot from live Sheets — pending approvals (with texts), compliance due soon, AP/AR/bank/employees/HR blockers. Read-only.',
    schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Optional; ignored — global health' },
      },
    },
    handler: async () => runPlatformHealthcheck(),
  },

  {
    id: 'internal.sub_agent.invoke',
    description:
      'Delegate to a registered sub-agent by id (invoice-extractor, tax-planning, document-generator, …).',
    schema: {
      type: 'object',
      properties: {
        sub_agent_id: { type: 'string', description: 'Agent id from configs/agents' },
        input: { type: 'string', description: 'Natural language task for the sub-agent' },
      },
      required: ['sub_agent_id', 'input'],
    },
    handler: async () => ({
      error: 'internal.sub_agent.invoke is handled inside runAgent',
    }),
  },
];

export function getRuntimeTools(): ToolDefinition[] {
  return toolDefinitions;
}

export function listToolDefinitions(): ToolDefinition[] {
  return toolDefinitions;
}
