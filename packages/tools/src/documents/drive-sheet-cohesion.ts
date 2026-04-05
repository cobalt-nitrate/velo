// Bridge Drive uploads to Google Sheets: file_links index + primary URL fields on business tabs.

import { APPROVAL_FILE_LINK_SCOPE } from '../sheets/approval-attachments.js';
import { executeSheetTool, recordVeloFileLink } from '../sheets/client.js';

export type DocumentFileLinkScope = {
  scope_table: string;
  scope_record_id: string;
  role: string;
};

/** Derive stable scope for the file_links index from document tool + params. */
export function inferFileLinkScopeFromDocumentTool(
  toolId: string,
  params: Record<string, unknown>,
  fallbackDocumentId: string
): DocumentFileLinkScope {
  const p = params;
  if (toolId.includes('pdf_generator') && toolId.includes('invoice')) {
    return {
      scope_table: 'ar_invoice',
      scope_record_id: String(p.invoice_id ?? fallbackDocumentId),
      role: 'generated_invoice_html',
    };
  }
  if (toolId.includes('upload_invoice')) {
    return {
      scope_table: 'ap_invoice',
      scope_record_id: String(p.invoice_id ?? p.ap_invoice_id ?? fallbackDocumentId),
      role: 'source_invoice_file',
    };
  }
  if (toolId.includes('generate_salary_slip')) {
    const sid = p.slip_id
      ? String(p.slip_id)
      : `${p.employee_id ?? 'emp'}_${p.month ?? ''}_${p.year ?? ''}`;
    return {
      scope_table: 'salary_slip',
      scope_record_id: sid || fallbackDocumentId,
      role: 'salary_slip_html',
    };
  }
  if (toolId.includes('generate_offer_letter')) {
    return {
      scope_table: 'hr_offer',
      scope_record_id: String(p.candidate_name ?? p.employee_id ?? fallbackDocumentId),
      role: 'offer_letter',
    };
  }
  if (toolId.includes('generate_experience_certificate')) {
    return {
      scope_table: 'hr_certificate',
      scope_record_id: String(p.employee_id ?? fallbackDocumentId),
      role: 'experience_certificate',
    };
  }
  if (toolId.includes('generate_relieving_letter')) {
    return {
      scope_table: 'hr_letter',
      scope_record_id: String(p.employee_id ?? fallbackDocumentId),
      role: 'relieving_letter',
    };
  }
  return {
    scope_table: 'document',
    scope_record_id: fallbackDocumentId,
    role: 'generated',
  };
}

/** Update primary URL columns on entity rows when ids are present (no-op if columns missing in sheet). */
async function syncPrimaryEntityUrls(
  toolId: string,
  params: Record<string, unknown>,
  fileId: string,
  url: string
): Promise<void> {
  const p = params;
  try {
    if (toolId.includes('pdf_generator') && toolId.includes('invoice') && p.invoice_id) {
      await executeSheetTool({
        tool_id: 'sheets.ar_invoices.update',
        invoice_id: String(p.invoice_id),
        invoice_pdf_url: url,
      });
      return;
    }
    if (toolId.includes('upload_invoice')) {
      const inv = p.invoice_id ?? p.ap_invoice_id;
      if (inv) {
        await executeSheetTool({
          tool_id: 'sheets.ap_invoices.update',
          invoice_id: String(inv),
          source_file_url: url,
        });
      }
      return;
    }
    if (toolId.includes('generate_salary_slip') && p.slip_id) {
      await executeSheetTool({
        tool_id: 'sheets.salary_slips.update',
        slip_id: String(p.slip_id),
        drive_url: url,
      });
      return;
    }

    const taskId = p.task_id;
    if (
      taskId &&
      (toolId.includes('offer_letter') ||
        toolId.includes('salary_slip') ||
        toolId.includes('experience_certificate') ||
        toolId.includes('relieving_letter'))
    ) {
      await executeSheetTool({
        tool_id: 'sheets.hr_tasks.update',
        task_id: String(taskId),
        primary_drive_url: url,
        primary_drive_file_id: fileId,
      });
    }
  } catch (err) {
    console.warn('[documents] Optional sheet URL sync failed:', err);
  }
}

export async function recordDocumentOnDriveAndSheets(params: {
  toolId: string;
  params: Record<string, unknown>;
  documentId: string;
  filename: string;
  mime: string;
  driveFileId: string;
  driveWebViewUrl: string;
}): Promise<void> {
  const { toolId, params: p, documentId, filename, mime, driveFileId, driveWebViewUrl } =
    params;

  if (toolId.includes('generate_secure_link')) {
    return;
  }

  const scope = inferFileLinkScopeFromDocumentTool(toolId, p, documentId);
  await recordVeloFileLink({
    scope_table: scope.scope_table,
    scope_record_id: scope.scope_record_id,
    role: scope.role,
    drive_file_id: driveFileId,
    drive_web_view_url: driveWebViewUrl,
    mime,
    filename,
    source: toolId,
  });

  const approvalRaw = p.approval_id ?? p.approvalId;
  if (approvalRaw) {
    await recordVeloFileLink({
      scope_table: APPROVAL_FILE_LINK_SCOPE,
      scope_record_id: String(approvalRaw),
      role: scope.role,
      drive_file_id: driveFileId,
      drive_web_view_url: driveWebViewUrl,
      mime,
      filename,
      source: `${toolId}:approval_context`,
      meta_json: JSON.stringify({
        primary_scope: scope.scope_table,
        primary_record_id: scope.scope_record_id,
      }),
    });
  }

  await syncPrimaryEntityUrls(toolId, p, driveFileId, driveWebViewUrl);
}
