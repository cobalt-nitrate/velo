/// <reference path="../pdf-parse.d.ts" />
// Invoice parser — extracts structured fields from raw invoice text or files.
// Pipeline:
//   1. If file_url provided → fetch file → extract text (PDF → pdf-parse, image → tesseract.js)
//   2. Apply regex extraction against the text
//   3. Return structured fields + confidence score

import type { Buffer } from 'node:buffer';

// ─── Text extraction ──────────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = await import('pdf-parse').then((m) => m.default ?? m);
  const data = await pdfParse(buffer as Buffer);
  return data.text ?? '';
}

async function extractTextFromImage(urlOrBuffer: string | Buffer): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(urlOrBuffer as string);
    return data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

async function fetchFileBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${url}`);
  const contentType = res.headers.get('content-type') ?? '';
  const arrayBuffer = await res.arrayBuffer();
  const { Buffer: NodeBuffer } = await import('node:buffer');
  return { buffer: NodeBuffer.from(arrayBuffer), contentType };
}

// ─── Regex extractors ─────────────────────────────────────────────────────────

const GSTIN_RE = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/g;

const AMOUNT_RE =
  /(?:(?:₹|Rs\.?|INR)\s*)([\d,]+(?:\.\d{1,2})?)/gi;

const DATE_RES = [
  // DD/MM/YYYY or DD-MM-YYYY
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/,
  // YYYY-MM-DD
  /\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
  // DD MMM YYYY or DD-MMM-YYYY
  /\b(\d{1,2})[\s\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-,](20\d{2})\b/i,
];

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function extractDates(text: string): string[] {
  const found: string[] = [];
  for (const re of DATE_RES) {
    for (const match of text.matchAll(new RegExp(re.source, 'gi'))) {
      const iso = normalizeDate(match);
      if (iso) found.push(iso);
    }
  }
  return [...new Set(found)];
}

function normalizeDate(match: RegExpMatchArray): string | null {
  const [, a, b, c] = match;
  if (!a || !b || !c) return null;

  // YYYY-MM-DD
  if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;

  // Month name
  const monthKey = b.toLowerCase().slice(0, 3);
  if (MONTHS[monthKey]) return `${c}-${MONTHS[monthKey]}-${a.padStart(2, '0')}`;

  // DD/MM/YYYY
  return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
}

function extractAmounts(text: string): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(AMOUNT_RE)) {
    const n = Number(match[1].replace(/,/g, ''));
    if (!isNaN(n) && n > 0) found.push(n);
  }
  return found;
}

function extractGstins(text: string): string[] {
  return [...new Set([...text.matchAll(GSTIN_RE)].map((m) => m[1]))];
}

function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    /(?:invoice\s*(?:no|num|number|#)?|inv\.?\s*(?:no|#)?|bill\s*no\.?)[:\s]*([A-Z0-9\/\-]{3,30})/i,
    /\b(INV[\/\-][A-Z0-9\/\-]{2,20})\b/i,
    /\b([A-Z]{2,4}[\/\-]\d{4}[\/\-\d]+)\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractVendorName(text: string, gstins: string[]): string | null {
  // Try to find company name near GSTIN
  for (const gstin of gstins) {
    const idx = text.indexOf(gstin);
    if (idx < 0) continue;
    // Look 200 chars before the GSTIN for a company name
    const before = text.slice(Math.max(0, idx - 200), idx);
    const lines = before.split('\n').filter((l) => l.trim().length > 3);
    const lastLine = lines[lines.length - 1]?.trim();
    if (lastLine && lastLine.length > 3 && lastLine.length < 80) {
      return lastLine;
    }
  }

  // Fallback: look for "From:" or standalone company name patterns
  const fromMatch = text.match(/^from\s*:\s*(.+)$/im);
  if (fromMatch?.[1]) return fromMatch[1].trim();

  const pvtMatch = text.match(/([A-Z][a-zA-Z\s]{5,50}(?:Pvt\.?\s*Ltd\.?|Private Limited|LLP|LLC|Inc\.?))/);
  if (pvtMatch?.[1]) return pvtMatch[1].trim();

  return null;
}

function extractHsnSac(text: string): string | null {
  const m = text.match(/(?:HSN|SAC|HSN\/SAC)[:\s]*([0-9]{4,8})/i);
  return m?.[1] ?? null;
}

function extractGstComponents(text: string, amounts: number[]): {
  igst: number; cgst: number; sgst: number; total_gst: number; gst_rate: number;
} {
  function extractLabeled(label: string): number {
    const re = new RegExp(`${label}[:\\s]*(?:₹|Rs\\.?|INR)?\\s*([\\d,]+(?:\\.\\d{1,2})?)`, 'i');
    const m = text.match(re);
    return m ? Number(m[1].replace(/,/g, '')) : 0;
  }

  const igst = extractLabeled('IGST');
  const cgst = extractLabeled('CGST');
  const sgst = extractLabeled('SGST');
  const total_gst = igst > 0 ? igst : cgst + sgst;

  // Try to extract GST rate
  const rateMatch = text.match(/(?:GST|IGST|CGST|SGST)[\s@]*([0-9]{1,2}(?:\.[05])?)%/i);
  const gst_rate = rateMatch ? Number(rateMatch[1]) : 0;

  return { igst, cgst, sgst, total_gst, gst_rate };
}

function extractPaymentTerms(text: string): number | null {
  const m = text.match(/(?:payment\s+terms?|due\s+in|net)[:\s]*(\d+)\s*days?/i);
  return m ? Number(m[1]) : null;
}

// ─── Confidence calculation ───────────────────────────────────────────────────

function computeConfidence(fields: Record<string, unknown>): number {
  const mandatoryFields = ['invoice_number', 'invoice_date', 'vendor_name', 'total_amount'];
  const extractedMandatory = mandatoryFields.filter((f) => {
    const v = fields[f];
    return v !== null && v !== undefined && v !== '';
  });

  let score = extractedMandatory.length / mandatoryFields.length;

  // Bonuses
  if (fields.vendor_gstin) score += 0.05;
  if (fields.gst_amount && (fields.gst_amount as number) > 0) score += 0.03;
  if (fields.invoice_number) score += 0.02;

  // Total amount check
  if (fields.subtotal && fields.gst_amount && fields.total_amount) {
    const expected = (fields.subtotal as number) + (fields.gst_amount as number);
    const actual = fields.total_amount as number;
    if (Math.abs(expected - actual) <= 1) score += 0.05;
    else score -= 0.10;
  }

  return Math.max(0, Math.min(0.99, Math.round(score * 100) / 100));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function parseInvoiceText(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let rawText = String(params.raw_text ?? params.text ?? '');

  // If a file URL is provided and we don't have text, extract it
  if (!rawText && params.file_url) {
    try {
      const url = String(params.file_url);
      const { buffer, contentType } = await fetchFileBuffer(url);

      if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
        rawText = await extractTextFromPdf(buffer);
      } else {
        // Assume image
        rawText = await extractTextFromImage(buffer);
      }
    } catch (err) {
      return {
        ok: false,
        error: `Failed to extract text from file: ${err instanceof Error ? err.message : String(err)}`,
        extracted_fields: null,
      };
    }
  }

  if (!rawText) {
    return {
      ok: false,
      error: 'No text or file_url provided',
      extracted_fields: null,
    };
  }

  // ── Extract all fields ─────────────────────────────────────────────────────

  const gstins = extractGstins(rawText);
  const dates = extractDates(rawText);
  const amounts = extractAmounts(rawText).sort((a, b) => b - a); // descending
  const gstComponents = extractGstComponents(rawText, amounts);

  const invoiceNumber = extractInvoiceNumber(rawText);
  const vendorName = extractVendorName(rawText, gstins);
  const hsnSac = extractHsnSac(rawText);
  const paymentTermsDays = extractPaymentTerms(rawText);

  // Heuristic: total is the largest amount, GST is usually the second largest
  const totalAmount = amounts[0] ?? null;
  const subtotal = gstComponents.total_gst > 0 && totalAmount
    ? totalAmount - gstComponents.total_gst
    : amounts[1] ?? null;

  const fields: Record<string, unknown> = {
    invoice_number: invoiceNumber,
    invoice_date: dates[0] ?? null,
    due_date: dates[1] ?? null,
    vendor_name: vendorName,
    vendor_gstin: gstins[0] ?? null,
    buyer_gstin: gstins[1] ?? null,
    subtotal,
    igst_amount: gstComponents.igst || null,
    cgst_amount: gstComponents.cgst || null,
    sgst_amount: gstComponents.sgst || null,
    gst_amount: gstComponents.total_gst || null,
    gst_rate_pct: gstComponents.gst_rate || null,
    total_amount: totalAmount,
    currency: 'INR',
    payment_terms_days: paymentTermsDays,
    hsn_sac_code: hsnSac,
    is_rcm: /reverse\s+charge/i.test(rawText),
    all_amounts_found: amounts,
    all_dates_found: dates,
  };

  const missingMandatory = ['invoice_number', 'invoice_date', 'vendor_name', 'total_amount']
    .filter((f) => !fields[f]);

  const confidence = computeConfidence(fields);

  return {
    ok: true,
    extraction_complete: missingMandatory.length === 0,
    missing_fields: missingMandatory,
    confidence,
    extracted_fields: fields,
    issues: [
      ...(missingMandatory.length > 0
        ? [`Missing mandatory fields: ${missingMandatory.join(', ')}`]
        : []),
      ...(gstins.length === 0 ? ['No GSTIN found — ITC cannot be claimed on unregistered vendor invoices'] : []),
    ],
    raw_text_length: rawText.length,
  };
}

// Thin wrappers — agent configs reference per-modality OCR tool ids.

export async function ocrExtractFromPdf(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = String(params.file_url ?? params.pdf_url ?? params.url ?? '');
  return parseInvoiceText({ ...params, file_url: url });
}

export async function ocrExtractFromImage(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = String(params.file_url ?? params.image_url ?? params.url ?? '');
  return parseInvoiceText({ ...params, file_url: url });
}

export async function ocrExtractFromText(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return parseInvoiceText({
    ...params,
    raw_text: String(params.raw_text ?? params.text ?? ''),
  });
}
