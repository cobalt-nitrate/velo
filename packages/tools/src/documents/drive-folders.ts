// Google Drive folder layout under VELO_DRIVE_FOLDER_ID (Velo “documents root”).
//
// Convention (created on demand):
//   uploads/
//     images/YYYY-MM/          screenshots, PNG/JPEG/WebP
//     screenshots/YYYY-MM/     optional distinct bucket (filename hints / explicit kind)
//     documents/YYYY-MM/       PDF, DOC/DOCX, RTF
//     spreadsheets/YYYY-MM/    XLS/XLSX, CSV (user uploads; sheets exports can reuse)
//     presentations/YYYY-MM/   PPT/PPTX
//     data/YYYY-MM/            JSON, TXT, XML
//   generated/
//     hr/YYYY/<employee_id>/   offer letters, salary slips, certificates
//     invoices/YYYY/           AR invoice HTML artifacts
//     misc/YYYY/               fallback
//
// Spreadsheets used as databases stay in the separate “Velo Data” workbook folder; this tree is for files.

import { Readable } from 'stream';
import type { drive_v3 } from 'googleapis';

function sanitizeSegment(s: string): string {
  return s
    .replace(/[/\\]/g, '-')
    .replace(/[^\w.\- ]+/g, '_')
    .trim()
    .slice(0, 120) || 'item';
}

function yearMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Escape a string for use inside Drive API `q` single-quoted literals. */
function escapeDriveQueryValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Walks or creates `rootId / seg1 / seg2 / …` and returns the leaf folder id.
 */
export async function ensureVeloDrivePath(
  drive: drive_v3.Drive,
  rootFolderId: string,
  segments: string[]
): Promise<string> {
  let parentId = rootFolderId;
  for (const raw of segments) {
    const name = sanitizeSegment(raw);
    if (!name) continue;
    const q = `'${escapeDriveQueryValue(parentId)}' in parents and name = '${escapeDriveQueryValue(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const list = await drive.files.list({
      q,
      fields: 'files(id)',
      pageSize: 5,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const existing = list.data.files?.[0]?.id;
    if (existing) {
      parentId = existing;
      continue;
    }
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    const id = created.data.id;
    if (!id) throw new Error(`Drive: failed to create folder "${name}"`);
    parentId = id;
  }
  return parentId;
}

const HR_TOOLS = [
  'generate_offer_letter',
  'generate_salary_slip',
  'generate_experience_certificate',
  'generate_relieving_letter',
];

/**
 * Target path for agent-generated HTML/PDF uploads from `generatePdfDocument`.
 */
export function segmentsForDocumentTool(
  toolId: string,
  params: Record<string, unknown>
): string[] {
  const year = String(params.year ?? new Date().getFullYear());
  const y = yearMonth();

  if (toolId.includes('upload_invoice')) {
    return ['uploads', 'invoices', 'source', y];
  }
  if (toolId.includes('pdf_generator') && toolId.includes('invoice')) {
    return ['generated', 'invoices', year];
  }
  if (HR_TOOLS.some((t) => toolId.includes(t))) {
    const emp =
      params.employee_id ??
      params.candidate_name ??
      params.name ??
      'general';
    const slug = sanitizeSegment(String(emp));
    return ['generated', 'hr', year, slug];
  }
  return ['generated', 'misc', year];
}

export type UploadedFileKind = 'screenshot' | 'image' | 'default';

/**
 * Target path for arbitrary user uploads (web / chat attachments) when mirroring to Drive.
 */
export function segmentsForUploadedFile(
  filename: string,
  mime: string,
  options?: { kind?: UploadedFileKind }
): string[] {
  const y = yearMonth();
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mimeLower = mime.toLowerCase();
  const kind = options?.kind;

  if (kind === 'screenshot') {
    return ['uploads', 'screenshots', y];
  }
  if (kind === 'image' || mimeLower.startsWith('image/')) {
    return ['uploads', 'images', y];
  }
  if (
    mimeLower.includes('pdf') ||
    ext === 'pdf' ||
    ext === 'doc' ||
    ext === 'docx' ||
    ext === 'rtf'
  ) {
    return ['uploads', 'documents', y];
  }
  if (
    mimeLower.includes('spreadsheet') ||
    mimeLower.includes('excel') ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'csv'
  ) {
    return ['uploads', 'spreadsheets', y];
  }
  if (
    mimeLower.includes('presentation') ||
    ext === 'ppt' ||
    ext === 'pptx'
  ) {
    return ['uploads', 'presentations', y];
  }
  if (ext === 'json' || mimeLower.includes('json')) {
    return ['uploads', 'data', 'json', y];
  }
  if (ext === 'txt' || ext === 'md' || mimeLower.startsWith('text/')) {
    return ['uploads', 'data', 'text', y];
  }
  if (ext === 'xml' || mimeLower.includes('xml')) {
    return ['uploads', 'data', 'xml', y];
  }

  return ['uploads', 'other', y];
}

/**
 * Upload arbitrary bytes as a file under a Drive folder (e.g. after `ensureVeloDrivePath`).
 * Matches document generator: “anyone with the link” can read (same as existing HTML uploads).
 */
export async function uploadBufferToDrive(
  drive: drive_v3.Drive,
  parentFolderId: string,
  name: string,
  mimeType: string,
  body: Buffer
): Promise<{ file_id: string; web_view_link: string; web_content_link?: string }> {
  const safeName = sanitizeSegment(name);
  const stream = Readable.from(body);
  const res = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType,
      parents: [parentFolderId],
    },
    media: { mimeType, body: stream },
    fields: 'id, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return {
    file_id: res.data.id ?? '',
    web_view_link: res.data.webViewLink ?? '',
    web_content_link: res.data.webContentLink ?? undefined,
  };
}
