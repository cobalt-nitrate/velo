import { parseBankStatement } from '@velo/tools/bank';
import { executeSheetTool } from '@velo/tools/sheets';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST { raw_text?, csv?, companyId?, persist?: boolean }
 * Parses a bank statement then optionally appends rows to bank_transactions.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? body.company_id ?? 'demo-company');
    const persist = body.persist !== false;

    const parsed = await parseBankStatement({
      raw_text: body.raw_text ?? body.text ?? body.csv,
      transactions: body.transactions,
    });

    let persistResult: Record<string, unknown> | null = null;
    if (persist && parsed.ok && parsed.transactions?.length) {
      const rows = parsed.transactions.map((t, i) => ({
        txn_id: `txn_${Date.now()}_${i}`,
        company_id: companyId,
        date: t.date,
        narration: t.narration,
        ref_number: t.ref_number,
        amount: String(t.amount),
        balance: String(t.balance),
        type: t.type,
        mode: t.mode,
        source: 'statement_upload',
        created_at: new Date().toISOString(),
      }));
      persistResult = await executeSheetTool({
        tool_id: 'sheets.bank_transactions.create_batch',
        company_id: companyId,
        rows,
      });
    }

    return NextResponse.json({ ...parsed, persist: persistResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
