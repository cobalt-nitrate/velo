/**
 * Phase 2 — one deterministic tool + Sheets path per module, including approval lifecycle.
 *
 *   pnpm --filter @velo/agents e2e:modules
 *
 * Loads repo-root `.env.local` when present. Without DATABASE_URL, data tools use in-memory stores.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getRepoRoot, validateAllVeloConfigs } from '@velo/core/config';
import { invokeRegisteredTool } from '../workflow/tool-invoke.js';
import {
  findApprovalById,
  isApprovalPendingStatus,
  mergeApprovalAttachmentsFromFileLinks,
  updateApprovalRow,
} from '@velo/tools/data';

function loadEnvLocal(): void {
  const p = resolve(getRepoRoot(), '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\n/g, '\n');
    }
    if (process.env[key] === undefined) process.env[key] = v;
  }
}

const companyId = 'demo-company';

function assertToolOk(res: unknown, label: string): asserts res is Record<string, unknown> {
  if (!res || typeof res !== 'object') throw new Error(`${label}: invalid result`);
  if ((res as Record<string, unknown>).ok === false) {
    throw new Error(`${label}: ${JSON.stringify(res)}`);
  }
}

async function resolveApproval(approvalId: string): Promise<void> {
  const found = await findApprovalById(approvalId);
  if (!found) throw new Error(`Approval not found: ${approvalId}`);
  if (!isApprovalPendingStatus(found.row.status)) {
    console.warn(`    (approval ${approvalId} already resolved: ${found.row.status})`);
    return;
  }
  const merged = await mergeApprovalAttachmentsFromFileLinks(
    approvalId,
    found.row.attachment_drive_urls_json ?? ''
  );
  await updateApprovalRow(found.spreadsheetId, found.rowIndex, found.headers, {
    status: 'APPROVED',
    resolved_by: 'e2e@velo.local',
    resolved_at: new Date().toISOString(),
    resolution_notes: 'e2e module-paths',
    attachment_drive_urls_json: merged,
  });
  const verify = await findApprovalById(approvalId);
  const st = String(verify?.row.status ?? '').toUpperCase();
  if (st !== 'APPROVED') {
    throw new Error(`Expected APPROVED on ${approvalId}, got ${verify?.row.status}`);
  }
}

function baseToolPayload(): Record<string, unknown> {
  return { company_id: companyId };
}

function nowIso(): string {
  return new Date().toISOString();
}

async function moduleRunway(): Promise<void> {
  const t = Date.now();
  const txnId = `e2e-txn-runway-${t}`;
  const p = {
    ...baseToolPayload(),
    tool_id: 'data.bank_transactions.create',
    txn_id: txnId,
    date: '2026-04-05',
    narration: 'E2E runway liquidity check',
    ref_number: `E2E-RW-${t}`,
    amount: '0',
    balance: '901234.56',
    type: 'credit',
    mode: 'system',
    source: 'e2e_module_paths',
    created_at: nowIso(),
  };
  assertToolOk(await invokeRegisteredTool('data.bank_transactions.create', p), 'bank_transactions.create');
  const bal = await invokeRegisteredTool('data.bank_transactions.get_latest_balance', {
    ...baseToolPayload(),
    tool_id: 'data.bank_transactions.get_latest_balance',
  });
  assertToolOk(bal, 'get_latest_balance');
  if (typeof bal.balance_inr !== 'number') throw new Error('get_latest_balance: missing balance_inr');
}

async function moduleCompliance(): Promise<void> {
  const t = Date.now();
  const obligationId = `e2e-tax-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.tax_obligations.create', {
      ...baseToolPayload(),
      tool_id: 'data.tax_obligations.create',
      obligation_id: obligationId,
      type: 'gst',
      period_month: '4',
      period_year: '2026',
      due_date: '2026-04-25',
      amount_inr: '12500',
      status: 'pending',
      paid_date: '',
      payment_reference: '',
      payroll_run_id: '',
      created_at: nowIso(),
    }),
    'tax_obligations.create'
  );

  const apprId = `e2e-appr-co-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.approval_requests.create', {
      ...baseToolPayload(),
      tool_id: 'data.approval_requests.create',
      approval_id: apprId,
      agent_id: 'compliance',
      action_type: 'REMIT_CHALLAN',
      action_payload_json: JSON.stringify({ obligation_id: obligationId }),
      confidence_score: '0.87',
      evidence_json: '{}',
      proposed_action_text: 'E2E approve challan settlement',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'PENDING',
      approver_role: 'CFO',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    }),
    'approval_requests.create(compliance)'
  );

  await resolveApproval(apprId);

  assertToolOk(
    await invokeRegisteredTool('data.tax_obligations.update', {
      ...baseToolPayload(),
      tool_id: 'data.tax_obligations.update',
      obligation_id: obligationId,
      status: 'paid',
      paid_date: '2026-04-05',
      payment_reference: `E2E-CHQ-${t}`,
      updated_at: nowIso(),
    }),
    'tax_obligations.update'
  );
}

async function modulePayroll(): Promise<void> {
  const t = Date.now();
  const runId = `e2e-run-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.payroll_runs.create', {
      ...baseToolPayload(),
      tool_id: 'data.payroll_runs.create',
      run_id: runId,
      month: '5',
      year: '2026',
      employee_count: '4',
      total_gross: '500000',
      total_deductions: '75000',
      total_net: '425000',
      pf_employer_total: '60000',
      esic_employer_total: '0',
      status: 'PENDING_APPROVAL',
      approved_by: '',
      approved_at: '',
      created_at: nowIso(),
    }),
    'payroll_runs.create'
  );

  const apprId = `e2e-appr-pay-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.approval_requests.create', {
      ...baseToolPayload(),
      tool_id: 'data.approval_requests.create',
      approval_id: apprId,
      agent_id: 'payroll',
      action_type: 'PAYOUT_BATCH',
      action_payload_json: JSON.stringify({ run_id: runId }),
      confidence_score: '0.91',
      evidence_json: '{}',
      proposed_action_text: 'E2E approve payroll run',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'PENDING',
      approver_role: 'CFO',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    }),
    'approval_requests.create(payroll)'
  );

  await resolveApproval(apprId);

  assertToolOk(
    await invokeRegisteredTool('data.payroll_runs.update_status', {
      ...baseToolPayload(),
      tool_id: 'data.payroll_runs.update_status',
      run_id: runId,
      status: 'paid',
      approved_by: 'e2e@velo.local',
      approved_at: nowIso(),
    }),
    'payroll_runs.update_status'
  );
}

async function moduleAp(): Promise<void> {
  const t = Date.now();
  const invoiceId = `e2e-ap-inv-${t}`;
  const apprId = `e2e-appr-ap-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.ap_invoices.create', {
      ...baseToolPayload(),
      tool_id: 'data.ap_invoices.create',
      invoice_id: invoiceId,
      vendor_id: 'demo-vnd-001',
      vendor_name: 'E2E Vendor AP',
      invoice_number: `E2E-AP-${t}`,
      invoice_date: '2026-04-05',
      due_date: '2026-05-05',
      line_items_json: JSON.stringify([
        { desc: 'E2E SaaS', qty: 1, rate: 10000, gst_pct: 18 },
      ]),
      subtotal: '10000',
      gst_amount: '1800',
      total_amount: '11800',
      expense_category: 'technology',
      sub_category: 'saas',
      itc_claimable: 'yes',
      itc_amount: '1800',
      payment_status: 'pending',
      payment_date: '',
      bank_reference: '',
      approver: 'finance@velo.local',
      approved_at: '',
      source_file_url: '',
      notes: 'e2e module path',
      created_at: nowIso(),
    }),
    'ap_invoices.create'
  );

  assertToolOk(
    await invokeRegisteredTool('data.approval_requests.create', {
      ...baseToolPayload(),
      tool_id: 'data.approval_requests.create',
      approval_id: apprId,
      agent_id: 'ap-invoice',
      action_type: 'VENDOR_PAYMENT',
      action_payload_json: JSON.stringify({ invoice_id: invoiceId }),
      confidence_score: '0.9',
      evidence_json: '{}',
      proposed_action_text: 'E2E AP payment',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'PENDING',
      approver_role: 'FINANCE',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    }),
    'approval_requests.create(ap)'
  );

  await resolveApproval(apprId);
}

async function moduleAr(): Promise<void> {
  const t = Date.now();
  const invoiceId = `e2e-ar-inv-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.ar_invoices.create', {
      ...baseToolPayload(),
      tool_id: 'data.ar_invoices.create',
      invoice_id: invoiceId,
      client_id: 'demo-cli-001',
      client_name: 'Horizon Retail India Pvt Ltd',
      invoice_number: `E2E-AR-${t}`,
      invoice_date: '2026-04-05',
      due_date: '2026-05-10',
      service_description: 'E2E AR professional fees',
      subtotal: '50000',
      igst: '0',
      cgst: '4500',
      sgst: '4500',
      total_amount: '59000',
      status: 'sent',
      payment_received_date: '',
      bank_reference: '',
      followup_count: '0',
      last_followup_date: '',
      invoice_pdf_url: '',
      created_at: nowIso(),
    }),
    'ar_invoices.create'
  );

  assertToolOk(
    await invokeRegisteredTool('data.gst_output_ledger.create', {
      ...baseToolPayload(),
      tool_id: 'data.gst_output_ledger.create',
      ledger_id: `e2e-gstout-${t}`,
      ar_invoice_id: invoiceId,
      client_name: 'Horizon Retail India Pvt Ltd',
      invoice_date: '2026-04-05',
      period_month: '4',
      period_year: '2026',
      taxable_amount: '50000',
      igst: '0',
      cgst: '4500',
      sgst: '4500',
      total_gst: '9000',
      created_at: nowIso(),
    }),
    'gst_output_ledger.create'
  );

  const apprId = `e2e-appr-ar-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.approval_requests.create', {
      ...baseToolPayload(),
      tool_id: 'data.approval_requests.create',
      approval_id: apprId,
      agent_id: 'ar-collections',
      action_type: 'ESCALATE_FOLLOWUP',
      action_payload_json: JSON.stringify({ invoice_id: invoiceId }),
      confidence_score: '0.84',
      evidence_json: '{}',
      proposed_action_text: 'E2E AR follow-up',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'PENDING',
      approver_role: 'CEO',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    }),
    'approval_requests.create(ar)'
  );

  await resolveApproval(apprId);
}

async function moduleHr(): Promise<void> {
  const t = Date.now();
  const taskId = `e2e-hr-task-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.hr_tasks.create', {
      ...baseToolPayload(),
      tool_id: 'data.hr_tasks.create',
      task_id: taskId,
      employee_id: 'demo-emp-001',
      task_type: 'onboarding_docs',
      description: 'E2E HR collect documents',
      due_date: '2026-04-30',
      status: 'open',
      completed_at: '',
      notes: 'e2e',
      primary_drive_url: '',
      primary_drive_file_id: '',
    }),
    'hr_tasks.create'
  );

  const apprId = `e2e-appr-hr-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.approval_requests.create', {
      ...baseToolPayload(),
      tool_id: 'data.approval_requests.create',
      approval_id: apprId,
      agent_id: 'hr',
      action_type: 'HR_TASK_ESCALATION',
      action_payload_json: JSON.stringify({ task_id: taskId }),
      confidence_score: '0.8',
      evidence_json: '{}',
      proposed_action_text: 'E2E HR acknowledge task',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'PENDING',
      approver_role: 'HR',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    }),
    'approval_requests.create(hr)'
  );

  await resolveApproval(apprId);

  assertToolOk(
    await invokeRegisteredTool('data.hr_tasks.update_status', {
      ...baseToolPayload(),
      tool_id: 'data.hr_tasks.update_status',
      task_id: taskId,
      status: 'completed',
      completed_at: nowIso(),
    }),
    'hr_tasks.update_status'
  );
}

async function moduleHelpdesk(): Promise<void> {
  const t = Date.now();
  const docId = `e2e-policy-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.policy_documents.create', {
      ...baseToolPayload(),
      tool_id: 'data.policy_documents.create',
      doc_id: docId,
      doc_type: 'e2e_helpdesk_article',
      version: '1.0',
      generated_at: nowIso(),
      generated_by: 'helpdesk-e2e',
      content_markdown: '# E2E\n\nDemo knowledge snippet.',
      gdrive_url: '',
    }),
    'policy_documents.create'
  );

  const apprId = `e2e-appr-hd-${t}`;
  assertToolOk(
    await invokeRegisteredTool('data.approval_requests.create', {
      ...baseToolPayload(),
      tool_id: 'data.approval_requests.create',
      approval_id: apprId,
      agent_id: 'helpdesk',
      action_type: 'PUBLISH_ARTICLE',
      action_payload_json: JSON.stringify({ doc_id: docId }),
      confidence_score: '0.82',
      evidence_json: '{}',
      proposed_action_text: 'E2E publish help article',
      created_at: nowIso(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'PENDING',
      approver_role: 'founder',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    }),
    'approval_requests.create(helpdesk)'
  );

  await resolveApproval(apprId);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const cfg = validateAllVeloConfigs();
  if (!cfg.ok) {
    console.error('Config validation failed:');
    for (const e of cfg.errors) console.error(`  ${e}`);
    process.exit(1);
  }

  const modules: [string, () => Promise<void>][] = [
    ['runway', moduleRunway],
    ['compliance', moduleCompliance],
    ['payroll', modulePayroll],
    ['ap', moduleAp],
    ['ar', moduleAr],
    ['hr', moduleHr],
    ['helpdesk', moduleHelpdesk],
  ];

  for (const [name, fn] of modules) {
    process.stdout.write(`E2E ${name} … `);
    await fn();
    console.log('ok');
  }

  console.log('\nAll module E2E paths completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
