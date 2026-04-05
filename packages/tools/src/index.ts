import type { ToolSchema } from '@velo/core/types';
import { executeSheetTool } from './sheets/client.js';
import { sendEmail } from './email/index.js';
import { sendNotification } from './notifications/index.js';
import { parseInvoiceText } from './ocr/invoice-parser.js';
import { parseBankStatement } from './bank/statement-parser.js';
import { generatePdfDocument } from './documents/pdf-generator.js';

type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

export interface ToolDefinition {
  id: string;
  description: string;
  schema: ToolSchema['input_schema'];
  handler: ToolHandler;
}

const COMMON_SCHEMA: ToolSchema['input_schema'] = {
  type: 'object',
  properties: {
    company_id: { type: 'string' },
    payload: { type: 'object' },
  },
};

const toolDefinitions: ToolDefinition[] = [
  {
    id: 'sheets.ap_invoices.create',
    description: 'Create AP invoice row in sheet',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ap_invoices.update',
    description: 'Update AP invoice row in sheet',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.ap_invoices.find_by_vendor_amount_date',
    description: 'Find AP invoice matches by vendor, amount, date',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.vendor_master.lookup_by_gstin',
    description: 'Lookup vendor using GSTIN',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.vendor_master.lookup_by_name_fuzzy',
    description: 'Lookup vendor using fuzzy name matching',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.vendor_master.create',
    description: 'Create vendor in vendor master',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.gst_input_ledger.create',
    description: 'Create GST input ledger row',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.expense_entries.create',
    description: 'Create expense ledger row',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.approval_requests.create',
    description: 'Create approval request entry',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'sheets.bank_payees.lookup',
    description: 'Lookup bank payee details',
    schema: COMMON_SCHEMA,
    handler: executeSheetTool,
  },
  {
    id: 'notifications.send_approval_request',
    description: 'Send approval request notification',
    schema: COMMON_SCHEMA,
    handler: sendNotification,
  },
  {
    id: 'documents.drive.upload_invoice',
    description: 'Upload invoice to document storage',
    schema: COMMON_SCHEMA,
    handler: generatePdfDocument,
  },
  {
    id: 'email.send_invoice',
    description: 'Send AR invoice via email',
    schema: COMMON_SCHEMA,
    handler: sendEmail,
  },
  {
    id: 'ocr.invoice.parse',
    description: 'Parse invoice text from OCR payload',
    schema: COMMON_SCHEMA,
    handler: parseInvoiceText,
  },
  {
    id: 'bank.statement.parse',
    description: 'Parse bank statement payload',
    schema: COMMON_SCHEMA,
    handler: parseBankStatement,
  },
];

export function getRuntimeTools(): ToolDefinition[] {
  return toolDefinitions;
}

export function listToolDefinitions(): ToolDefinition[] {
  return toolDefinitions;
}
