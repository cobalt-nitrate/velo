import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ApprovalSignal = {
  signal: string;
  score: number; // 0..1
  detail: string;
};

export type EvidenceItem = {
  kind: string;
  label: string;
  value: string;
  source?: string;
};

export type ApprovalEvidenceBundle = {
  approval_id: string;
  agent_id: string;
  action_type: string;
  status: string;
  confidence_score: string;
  signals: ApprovalSignal[];
  sections: Array<{
    id: string;
    title: string;
    items: EvidenceItem[];
  }>;
  raw: {
    action_payload: Record<string, unknown>;
    evidence: unknown[];
  };
};

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asNumber01(x: unknown): number | null {
  const n = typeof x === 'number' ? x : Number(String(x ?? '').trim());
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function fmtInr(x: unknown): string {
  const n = Number(String(x ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(x ?? '—');
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

function toEvidenceItem(v: unknown): EvidenceItem[] {
  if (v == null) return [];
  if (typeof v === 'string') return v.trim() ? [{ kind: 'note', label: 'Note', value: v.trim() }] : [];
  if (typeof v !== 'object') return [{ kind: 'value', label: 'Value', value: String(v) }];
  if (Array.isArray(v)) {
    return v.flatMap((x) => toEvidenceItem(x));
  }
  const o = v as Record<string, unknown>;
  const label = String(o.label ?? o.field ?? o.name ?? '').trim();
  const value = String(o.value ?? o.val ?? o.text ?? '').trim();
  const kind = String(o.kind ?? o.type ?? 'evidence').trim();
  if (label && value) return [{ kind, label, value, source: o.source ? String(o.source) : undefined }];
  // fallback: dump a single compact line
  return [{ kind: 'evidence', label: 'Evidence', value: JSON.stringify(o) }];
}

async function computeApVendorHistory(params: {
  vendorId?: string;
  vendorName?: string;
}): Promise<EvidenceItem[]> {
  const vendorId = params.vendorId?.trim() || '';
  const vendorName = params.vendorName?.trim() || '';
  if (!vendorId && !vendorName) return [];

  const where: Prisma.ApInvoiceWhereInput = vendorId
    ? { vendorId }
    : vendorName
      ? { vendorName }
      : {};

  const invoices = await prisma.apInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      invoiceId: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      totalAmount: true,
      paymentStatus: true,
      paymentDate: true,
      bankReference: true,
    },
  });

  if (invoices.length === 0) return [{ kind: 'history', label: 'Past invoices', value: 'No matching AP invoices found.' }];

  const totals = invoices.map((i) => Number(String(i.totalAmount ?? '').replace(/,/g, '')) || 0);
  const sum = totals.reduce((a, b) => a + b, 0);
  const paid = invoices.filter((i) => String(i.paymentStatus ?? '').toLowerCase() === 'paid').length;

  const lastPaid = invoices
    .filter((i) => String(i.paymentStatus ?? '').toLowerCase() === 'paid' && String(i.paymentDate ?? '').trim())
    .sort((a, b) => String(b.paymentDate ?? '').localeCompare(String(a.paymentDate ?? '')))[0];

  return [
    { kind: 'history', label: 'Invoices found', value: String(invoices.length) },
    { kind: 'history', label: 'Total billed (sample)', value: fmtInr(sum) },
    { kind: 'history', label: 'Paid invoices (sample)', value: String(paid) },
    ...(lastPaid
      ? [
          {
            kind: 'history',
            label: 'Last paid',
            value: `${lastPaid.paymentDate} · ${fmtInr(lastPaid.totalAmount)} · ${lastPaid.invoiceNumber || lastPaid.invoiceId}`,
          },
        ]
      : []),
  ];
}

function extractSignalsFromLegacyEvidence(evidence: unknown[]): ApprovalSignal[] {
  const out: ApprovalSignal[] = [];
  for (const e of evidence) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    const o = e as Record<string, unknown>;
    const signal = String(o.signal ?? o.name ?? o.key ?? '').trim();
    const score = asNumber01(o.score ?? o.value);
    if (!signal || score == null) continue;
    out.push({
      signal,
      score,
      detail: String(o.detail ?? o.notes ?? o.reason ?? ''),
    });
  }
  return out;
}

export async function assembleApprovalEvidence(approvalId: string): Promise<ApprovalEvidenceBundle | null> {
  const approval = await prisma.approvalRequest.findUnique({
    where: { approvalId },
    select: {
      approvalId: true,
      agentId: true,
      actionType: true,
      actionPayloadJson: true,
      evidenceJson: true,
      confidenceScore: true,
      status: true,
    },
  });
  if (!approval) return null;

  const actionPayload = safeJsonParse<Record<string, unknown>>(approval.actionPayloadJson ?? '{}', {});
  const legacyEvidence = safeJsonParse<unknown[]>(approval.evidenceJson ?? '[]', []);

  // Fetch stored rows
  const [storedSignals, storedEvidenceItems] = await Promise.all([
    prisma.approvalSignalScore.findMany({
      where: { approvalId },
      orderBy: { score: 'desc' },
      take: 100,
      select: { signal: true, score: true, detail: true },
    }),
    prisma.approvalEvidenceItem.findMany({
      where: { approvalId },
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
      take: 500,
      select: { kind: true, label: true, value: true, source: true },
    }),
  ]);

  // Lazy backfill if empty (keeps system consistent without requiring agent upgrades)
  if (storedSignals.length === 0 || storedEvidenceItems.length === 0) {
    await prisma.$transaction(async (tx) => {
      if (storedSignals.length === 0) {
        const derived = extractSignalsFromLegacyEvidence(legacyEvidence);
        const overall = asNumber01(approval.confidenceScore);
        const rows = [
          ...(derived.length ? derived : []),
          ...(overall != null ? [{ signal: 'overall', score: overall, detail: '' }] : []),
        ]
          .filter((s, idx, arr) => arr.findIndex((x) => x.signal === s.signal) === idx)
          .slice(0, 25);

        if (rows.length) {
          await tx.approvalSignalScore.createMany({
            data: rows.map((s) => ({
              approvalId,
              signal: s.signal,
              score: s.score,
              detail: s.detail,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (storedEvidenceItems.length === 0 && Array.isArray(legacyEvidence) && legacyEvidence.length) {
        const items = legacyEvidence.flatMap((e) => toEvidenceItem(e)).slice(0, 200);
        if (items.length) {
          await tx.approvalEvidenceItem.createMany({
            data: items.map((i) => ({
              approvalId,
              kind: i.kind,
              label: i.label,
              value: i.value,
              source: i.source ?? 'legacy_evidence_json',
              meta: {},
            })),
            skipDuplicates: true,
          });
        }
      }
    });
  }

  const [signalsAfter, itemsAfter] = await Promise.all([
    prisma.approvalSignalScore.findMany({
      where: { approvalId },
      orderBy: { score: 'desc' },
      take: 100,
      select: { signal: true, score: true, detail: true },
    }),
    prisma.approvalEvidenceItem.findMany({
      where: { approvalId },
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
      take: 500,
      select: { kind: true, label: true, value: true, source: true },
    }),
  ]);

  const vendorId = String(actionPayload.vendor_id ?? actionPayload.vendorId ?? '').trim();
  const vendorName = String(actionPayload.vendor_name ?? actionPayload.vendorName ?? '').trim();

  const vendorHistoryItems = await computeApVendorHistory({ vendorId, vendorName });

  const primary: EvidenceItem[] = [
    ...(vendorName ? [{ kind: 'invoice', label: 'Vendor', value: vendorName }] : []),
    ...(String(actionPayload.invoice_number ?? '').trim()
      ? [{ kind: 'invoice', label: 'Invoice #', value: String(actionPayload.invoice_number ?? '') }]
      : []),
    ...(String(actionPayload.invoice_date ?? '').trim()
      ? [{ kind: 'invoice', label: 'Invoice date', value: String(actionPayload.invoice_date ?? '') }]
      : []),
    ...(String(actionPayload.total_amount ?? '').trim()
      ? [{ kind: 'invoice', label: 'Total', value: fmtInr(actionPayload.total_amount) }]
      : []),
  ];

  const evidenceItems: EvidenceItem[] = itemsAfter.map((e) => ({
    kind: e.kind,
    label: e.label,
    value: e.value,
    source: e.source || undefined,
  }));

  return {
    approval_id: approval.approvalId,
    agent_id: approval.agentId,
    action_type: approval.actionType,
    status: approval.status,
    confidence_score: approval.confidenceScore,
    signals: signalsAfter.map((s) => ({
      signal: s.signal,
      score: s.score,
      detail: s.detail,
    })),
    sections: [
      { id: 'primary', title: 'Extracted fields', items: primary },
      { id: 'evidence', title: 'Supporting evidence', items: evidenceItems },
      { id: 'history', title: 'Past payment history', items: vendorHistoryItems },
    ].filter((s) => s.items.length > 0),
    raw: {
      action_payload: actionPayload,
      evidence: legacyEvidence,
    },
  };
}

