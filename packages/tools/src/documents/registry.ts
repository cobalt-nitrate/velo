import crypto from 'crypto';
import { prisma } from '../data/prisma.js';
import { sha256Hex } from './renderer.js';

export type DocumentType =
  | 'salary_slip'
  | 'offer_letter'
  | 'experience_certificate'
  | 'relieving_letter'
  | 'ar_invoice'
  | 'ap_invoice_source'
  | 'other';

export type DocumentStorage = 'drive' | 'inline' | 'local';
export type DocumentFormat = 'pdf' | 'html';

export function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function randomTokenId(): string {
  return `dt_${crypto.randomBytes(18).toString('hex')}`;
}

export function deriveDocumentType(toolId: string): DocumentType {
  const t = toolId.toLowerCase();
  if (t.includes('generate_salary_slip')) return 'salary_slip';
  if (t.includes('generate_offer_letter')) return 'offer_letter';
  if (t.includes('generate_experience_certificate')) return 'experience_certificate';
  if (t.includes('generate_relieving_letter')) return 'relieving_letter';
  if (t.includes('pdf_generator') && t.includes('invoice')) return 'ar_invoice';
  if (t.includes('upload_invoice')) return 'ap_invoice_source';
  return 'other';
}

export function deriveSubject(params: Record<string, unknown>, docType: DocumentType): {
  subjectType: string;
  subjectId: string;
  employeeEmail: string;
  title: string;
  periodMonth: string;
  periodYear: string;
} {
  const employeeEmail = String(params.employee_email ?? params.email ?? '').trim().toLowerCase();
  const periodMonth = String(params.month ?? params.period_month ?? '').trim();
  const periodYear = String(params.year ?? params.period_year ?? '').trim();

  if (docType === 'salary_slip' || docType.startsWith('relieving') || docType.includes('certificate')) {
    const empId = String(params.employee_id ?? '').trim();
    const name = String(params.employee_name ?? params.candidate_name ?? '').trim();
    return {
      subjectType: 'employee',
      subjectId: empId || employeeEmail || name || 'unknown',
      employeeEmail,
      title:
        docType === 'salary_slip'
          ? `Salary slip ${periodMonth} ${periodYear}`.trim()
          : docType === 'experience_certificate'
            ? `Experience certificate`
            : docType === 'relieving_letter'
              ? `Relieving letter`
              : `Employee document`,
      periodMonth,
      periodYear,
    };
  }

  if (docType === 'offer_letter') {
    const cand = String(params.candidate_name ?? params.employee_name ?? '').trim();
    return {
      subjectType: 'candidate',
      subjectId: cand || employeeEmail || 'unknown',
      employeeEmail,
      title: cand ? `Offer letter · ${cand}` : 'Offer letter',
      periodMonth,
      periodYear,
    };
  }

  if (docType === 'ar_invoice') {
    const inv = String(params.invoice_id ?? params.invoice_number ?? '').trim();
    return {
      subjectType: 'ar_invoice',
      subjectId: inv || 'unknown',
      employeeEmail: '',
      title: inv ? `AR invoice · ${inv}` : 'AR invoice',
      periodMonth,
      periodYear,
    };
  }

  if (docType === 'ap_invoice_source') {
    const inv = String(params.invoice_id ?? params.ap_invoice_id ?? '').trim();
    return {
      subjectType: 'ap_invoice',
      subjectId: inv || 'unknown',
      employeeEmail: '',
      title: inv ? `AP invoice source · ${inv}` : 'AP invoice source',
      periodMonth,
      periodYear,
    };
  }

  const fallback = String(params.document_id ?? '').trim();
  return {
    subjectType: 'document',
    subjectId: fallback || 'unknown',
    employeeEmail,
    title: 'Document',
    periodMonth,
    periodYear,
  };
}

export function computeStableDocumentId(args: {
  type: DocumentType;
  subjectType: string;
  subjectId: string;
  periodMonth: string;
  periodYear: string;
}): string {
  const key = [
    args.type,
    args.subjectType,
    args.subjectId,
    args.periodYear,
    args.periodMonth,
  ]
    .map((s) => String(s ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join('|');
  const h = crypto.createHash('sha256').update(key).digest('hex').slice(0, 18);
  return `doc_${h}`;
}

export async function recordDocumentAndVersion(input: {
  toolId: string;
  params: Record<string, unknown>;
  actor?: string;
  source?: string;
  format: DocumentFormat;
  mime: string;
  bytes?: Buffer | null;
  html?: string | null;
  storage: DocumentStorage;
  drive?: { fileId: string; webViewUrl: string } | null;
  inlineDataUrl?: string;
  filename: string;
}): Promise<{ document_id: string; version_id: string }> {
  const docType = deriveDocumentType(input.toolId);
  const subj = deriveSubject(input.params, docType);
  const documentId = computeStableDocumentId({
    type: docType,
    subjectType: subj.subjectType,
    subjectId: subj.subjectId,
    periodMonth: subj.periodMonth,
    periodYear: subj.periodYear,
  });
  const versionId = randomId('dv');

  const buf =
    input.format === 'pdf'
      ? (input.bytes ?? null)
      : Buffer.from(String(input.html ?? ''), 'utf8');
  const bytes = buf ?? Buffer.from('', 'utf8');

  const sha256 = sha256Hex(bytes);
  const sizeBytes = bytes.byteLength;

  await prisma.$transaction(async (tx) => {
    await tx.document.upsert({
      where: { documentId },
      create: {
        documentId,
        type: docType,
        title: subj.title,
        subjectType: subj.subjectType,
        subjectId: subj.subjectId,
        employeeEmail: subj.employeeEmail,
        periodMonth: subj.periodMonth,
        periodYear: subj.periodYear,
        tagsJson: '',
        createdBy: input.actor ?? '',
        source: input.source ?? input.toolId,
        latestVersionId: versionId,
      },
      update: {
        title: subj.title,
        employeeEmail: subj.employeeEmail,
        source: input.source ?? input.toolId,
        latestVersionId: versionId,
      },
    });

    await tx.documentVersion.create({
      data: {
        versionId,
        documentId,
        format: input.format,
        mime: input.mime,
        sha256,
        sizeBytes,
        storage: input.storage,
        driveFileId: input.drive?.fileId ?? '',
        driveWebViewUrl: input.drive?.webViewUrl ?? '',
        localUploadId: '',
        inlineDataUrl: input.inlineDataUrl ?? '',
        renderParamsJson: JSON.stringify({
          tool_id: input.toolId,
          ...input.params,
        }),
      },
    });
  });

  return { document_id: documentId, version_id: versionId };
}

export async function issueAccessToken(input: {
  document_id?: string;
  version_id?: string;
  expiry_hours: number;
  scope: 'preview' | 'download';
  created_by?: string;
  recipient_email?: string;
}): Promise<{ token_id: string; expires_at: string }> {
  const documentId = String(input.document_id ?? '').trim();
  const versionId = String(input.version_id ?? '').trim();
  if (!documentId && !versionId) throw new Error('document_id or version_id required');

  const expiryHours = Number(input.expiry_hours ?? 72);
  const hours = Number.isFinite(expiryHours) ? Math.max(1, Math.min(24 * 30, expiryHours)) : 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const tokenId = randomTokenId();

  await prisma.documentAccessToken.create({
    data: {
      tokenId,
      documentId,
      versionId,
      scope: input.scope,
      recipientEmail: String(input.recipient_email ?? '').trim().toLowerCase(),
      createdBy: String(input.created_by ?? ''),
      expiresAt,
    },
  });

  return { token_id: tokenId, expires_at: expiresAt.toISOString() };
}

export async function findVersionByDriveFileId(fileId: string): Promise<{ document_id: string; version_id: string } | null> {
  const rec = await prisma.documentVersion.findFirst({
    where: { driveFileId: fileId },
    select: { documentId: true, versionId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!rec) return null;
  return { document_id: rec.documentId, version_id: rec.versionId };
}

