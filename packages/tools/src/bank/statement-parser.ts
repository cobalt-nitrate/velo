// Bank statement parser — ingests Indian bank statement formats and returns
// structured transactions. Supported formats:
//   1. CSV (HDFC, ICICI, Kotak, Axis, SBI — all have slightly different column layouts)
//   2. OFX/QFX (Open Financial Exchange — exported by most banks)
//   3. Structured JSON array (direct API integration)
//
// All amounts are in INR. Debits are negative, credits are positive.

export interface BankTransaction {
  date: string;           // YYYY-MM-DD
  narration: string;      // Description
  ref_number: string;     // Cheque/reference number if available
  amount: number;         // Positive = credit, negative = debit
  balance: number;        // Running balance after transaction
  type: 'CREDIT' | 'DEBIT';
  mode: string;           // NEFT, IMPS, UPI, RTGS, ATM, CASH, etc.
}

export interface ParsedStatement {
  ok: boolean;
  format_detected: string;
  bank_detected?: string;
  account_number?: string;
  opening_balance?: number;
  closing_balance?: number;
  from_date?: string;
  to_date?: string;
  transaction_count: number;
  total_credits: number;
  total_debits: number;
  net_flow: number;
  transactions: BankTransaction[];
  errors: string[];
}

// ─── Date normalizer ──────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function normalizeDate(raw: string): string {
  if (!raw) return '';
  const s = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.]((?:19|20)\d{2})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // DD-MMM-YYYY or DD/MMM/YYYY (e.g., 15-Mar-2025, 01 Jan 2025)
  const dmmy = s.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3})[\s\-\/]((?:19|20)\d{2})$/);
  if (dmmy) {
    const mo = MONTH_MAP[dmmy[2].toLowerCase()];
    if (mo) return `${dmmy[3]}-${mo}-${dmmy[1].padStart(2, '0')}`;
  }

  // YYYY/MM/DD
  const ymd = s.match(/^((?:19|20)\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;

  return s; // Return as-is if unparseable
}

// ─── Amount parser ────────────────────────────────────────────────────────────

function parseAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

// ─── Transaction mode detection ────────────────────────────────────────────────

function detectMode(narration: string): string {
  const n = narration.toUpperCase();
  if (/\bUPI\b/.test(n)) return 'UPI';
  if (/\bNEFT\b/.test(n)) return 'NEFT';
  if (/\bRTGS\b/.test(n)) return 'RTGS';
  if (/\bIMPS\b/.test(n)) return 'IMPS';
  if (/\bATM\b/.test(n)) return 'ATM';
  if (/\bACH\b/.test(n)) return 'ACH';
  if (/\bCLG\b|\bCHEQUE\b|\bCHQ\b/.test(n)) return 'CHEQUE';
  if (/\bCASH\b|\bDEPOSIT\b/.test(n)) return 'CASH';
  if (/\bINT\b|\bINTEREST\b/.test(n)) return 'INTEREST';
  if (/\bCHARGE\b|\bFEE\b|\bGST\b|\bTAX\b/.test(n)) return 'CHARGES';
  return 'OTHER';
}

// ─── CSV parser ────────────────────────────────────────────────────────────────

interface ColumnMap {
  date: number; narration: number; ref?: number;
  debit?: number; credit?: number; amount?: number; balance: number;
}

// Known CSV column layouts for Indian banks
const BANK_CSV_PROFILES: Array<{ name: string; headers: string[]; map: ColumnMap }> = [
  {
    name: 'HDFC',
    headers: ['date', 'narration', 'value date', 'debit amount', 'credit amount', 'chq./ref.no.', 'closing balance'],
    map: { date: 0, narration: 1, ref: 5, debit: 3, credit: 4, balance: 6 },
  },
  {
    name: 'ICICI',
    headers: ['transaction date', 'value date', 'description', 'ref no./cheque no.', 'debit', 'credit', 'balance'],
    map: { date: 0, narration: 2, ref: 3, debit: 4, credit: 5, balance: 6 },
  },
  {
    name: 'Axis',
    headers: ['tran date', 'chq no', 'particulars', 'debit', 'credit', 'balance'],
    map: { date: 0, ref: 1, narration: 2, debit: 3, credit: 4, balance: 5 },
  },
  {
    name: 'SBI',
    headers: ['txn date', 'value date', 'description', 'ref no./cheque no.', 'debit', 'credit', 'balance'],
    map: { date: 0, narration: 2, ref: 3, debit: 4, credit: 5, balance: 6 },
  },
  {
    name: 'Kotak',
    headers: ['date', 'transaction id', 'description', 'amount', 'balance'],
    map: { date: 0, narration: 2, ref: 1, amount: 3, balance: 4 },
  },
  // Generic fallback: date, description, debit, credit, balance
  {
    name: 'Generic',
    headers: ['date', 'description', 'debit', 'credit', 'balance'],
    map: { date: 0, narration: 1, debit: 2, credit: 3, balance: 4 },
  },
];

function detectBankProfile(headerRow: string[]): { name: string; map: ColumnMap } {
  const normalized = headerRow.map((h) => h.toLowerCase().trim());
  let bestMatch = { score: -1, profile: BANK_CSV_PROFILES[BANK_CSV_PROFILES.length - 1] };

  for (const profile of BANK_CSV_PROFILES) {
    const score = profile.headers.filter((h) => normalized.includes(h)).length;
    if (score > bestMatch.score) {
      bestMatch = { score, profile };
    }
  }
  return { name: bestMatch.profile.name, map: bestMatch.profile.map };
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function parseCSVStatement(text: string): Partial<ParsedStatement> & { transactions: BankTransaction[]; errors: string[] } {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.length > 0));
  if (rows.length < 2) return { transactions: [], errors: ['CSV has fewer than 2 rows'] };

  // Find the header row (first row with 4+ non-empty cells)
  const headerIdx = rows.findIndex((r) => r.filter((c) => c.length > 0).length >= 4);
  if (headerIdx < 0) return { transactions: [], errors: ['No header row found in CSV'] };

  const { name: bankName, map } = detectBankProfile(rows[headerIdx]);
  const dataRows = rows.slice(headerIdx + 1);

  const transactions: BankTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.length < 3) continue;
    const dateRaw = row[map.date] ?? '';
    if (!dateRaw || /^-+$/.test(dateRaw)) continue;

    const date = normalizeDate(dateRaw);
    if (!date) {
      errors.push(`Row ${headerIdx + i + 2}: unparseable date "${dateRaw}"`);
      continue;
    }

    const narration = row[map.narration] ?? '';
    const ref = map.ref !== undefined ? (row[map.ref] ?? '') : '';
    const balance = parseAmount(row[map.balance]);

    let amount: number;
    let type: 'CREDIT' | 'DEBIT';

    if (map.amount !== undefined) {
      // Single amount column: negative = debit, positive = credit
      const raw = parseAmount(row[map.amount]);
      amount = raw;
      type = raw >= 0 ? 'CREDIT' : 'DEBIT';
    } else {
      const di = map.debit;
      const cr = map.credit;
      if (di === undefined || cr === undefined) {
        errors.push(
          `Row ${headerIdx + i + 2}: bank profile missing debit/credit column indices`
        );
        continue;
      }
      const debit = parseAmount(row[di]);
      const credit = parseAmount(row[cr]);
      if (credit > 0) {
        amount = credit;
        type = 'CREDIT';
      } else {
        amount = -debit;
        type = 'DEBIT';
      }
    }

    transactions.push({
      date,
      narration,
      ref_number: ref,
      amount,
      balance,
      type,
      mode: detectMode(narration),
    });
  }

  return { bank_detected: bankName, transactions, errors };
}

// ─── OFX/QFX parser ───────────────────────────────────────────────────────────

function parseOFXStatement(text: string): Partial<ParsedStatement> & { transactions: BankTransaction[]; errors: string[] } {
  const transactions: BankTransaction[] = [];
  const errors: string[] = [];

  // Extract STMTTRN blocks
  const txnBlocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];

  for (const block of txnBlocks) {
    const content = block[1];
    const extract = (tag: string) => {
      const m = content.match(new RegExp(`<${tag}>([^<]+)`, 'i'));
      return m?.[1]?.trim() ?? '';
    };

    const dtposted = extract('DTPOSTED');
    const trnamt = extract('TRNAMT');
    const name = extract('NAME') || extract('MEMO');
    const fitid = extract('FITID');
    const trntype = extract('TRNTYPE').toUpperCase();

    const rawDate = dtposted.slice(0, 8); // YYYYMMDD
    const date = rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : normalizeDate(dtposted);

    const amount = parseFloat(trnamt);
    if (isNaN(amount)) {
      errors.push(`OFX transaction ${fitid}: invalid amount "${trnamt}"`);
      continue;
    }

    transactions.push({
      date,
      narration: name,
      ref_number: fitid,
      amount,
      balance: 0, // OFX doesn't always include running balance per txn
      type: amount >= 0 ? 'CREDIT' : 'DEBIT',
      mode: detectMode(name),
    });
  }

  // Try to extract ledger balance
  const ledgerBalance = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<]+)/i)?.[1];
  const closingBalance = ledgerBalance ? parseFloat(ledgerBalance) : undefined;

  // Try to extract account number
  const acctId = text.match(/<ACCTID>([^<]+)/i)?.[1]?.trim();

  return {
    account_number: acctId,
    closing_balance: closingBalance,
    transactions,
    errors,
  };
}

// ─── Summary calculator ────────────────────────────────────────────────────────

function summarize(txns: BankTransaction[]) {
  let totalCredits = 0;
  let totalDebits = 0;
  const dates = txns.map((t) => t.date).filter(Boolean).sort();

  for (const t of txns) {
    if (t.type === 'CREDIT') totalCredits += t.amount;
    else totalDebits += Math.abs(t.amount);
  }

  return {
    total_credits: Math.round(totalCredits * 100) / 100,
    total_debits: Math.round(totalDebits * 100) / 100,
    net_flow: Math.round((totalCredits - totalDebits) * 100) / 100,
    from_date: dates[0],
    to_date: dates[dates.length - 1],
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function parseBankStatement(
  params: Record<string, unknown>
): Promise<ParsedStatement> {
  // Already structured JSON transactions
  if (Array.isArray(params.transactions) && params.transactions.length > 0) {
    const transactions = (params.transactions as Record<string, unknown>[]).map((t) => ({
      date: normalizeDate(String(t.date ?? '')),
      narration: String(t.narration ?? t.description ?? ''),
      ref_number: String(t.ref_number ?? t.ref ?? ''),
      amount: parseAmount(t.amount as string),
      balance: parseAmount(t.balance as string),
      type: (String(t.type ?? '').toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT') as 'CREDIT' | 'DEBIT',
      mode: detectMode(String(t.narration ?? t.description ?? '')),
    }));
    const summary = summarize(transactions);
    return {
      ok: true,
      format_detected: 'json',
      transaction_count: transactions.length,
      ...summary,
      transactions,
      errors: [],
    };
  }

  const rawText = String(params.raw_text ?? params.text ?? params.csv ?? '');
  if (!rawText) {
    return {
      ok: false,
      format_detected: 'unknown',
      transaction_count: 0,
      total_credits: 0,
      total_debits: 0,
      net_flow: 0,
      transactions: [],
      errors: ['No input provided. Supply transactions (JSON array), raw_text (CSV), or text (OFX).'],
    };
  }

  let parsed: Partial<ParsedStatement> & { transactions: BankTransaction[]; errors: string[] };
  let format_detected: string;

  if (rawText.includes('<OFX>') || rawText.includes('<STMTTRN>') || rawText.includes('OFXHEADER')) {
    format_detected = 'ofx';
    parsed = parseOFXStatement(rawText);
  } else {
    format_detected = 'csv';
    parsed = parseCSVStatement(rawText);
  }

  const summary = summarize(parsed.transactions);

  return {
    ok: true,
    format_detected,
    bank_detected: parsed.bank_detected,
    account_number: parsed.account_number,
    opening_balance: parsed.opening_balance,
    closing_balance: parsed.closing_balance,
    ...summary,
    transaction_count: parsed.transactions.length,
    transactions: parsed.transactions,
    errors: parsed.errors,
  };
}
