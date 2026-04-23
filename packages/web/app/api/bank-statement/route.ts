import { parseBankStatement } from '@velo/tools/bank';
import { executeDataTool, recordVeloFileLink } from '@velo/tools/data';
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
    const statementDriveUrl = body.statement_drive_url ?? body.statementDriveUrl;
    const statementDriveFileId = body.statement_drive_file_id ?? body.statementDriveFileId;
    const importBatchId = String(
      body.import_batch_id ?? body.importBatchId ?? `stmt_${companyId}_${Date.now()}`
    );

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
      persistResult = await executeDataTool({
        tool_id: 'data.bank_transactions.create_batch',
        company_id: companyId,
        rows,
      });
    }

    if (
      typeof statementDriveUrl === 'string' &&
      statementDriveUrl &&
      typeof statementDriveFileId === 'string' &&
      statementDriveFileId
    ) {
      await recordVeloFileLink({
        scope_table: 'bank_statement_import',
        scope_record_id: importBatchId,
        role: 'statement_source',
        drive_file_id: statementDriveFileId,
        drive_web_view_url: statementDriveUrl,
        mime: body.statement_mime ? String(body.statement_mime) : 'application/pdf',
        filename: body.statement_filename ? String(body.statement_filename) : 'statement',
        source: 'bank-statement-api',
        meta_json: JSON.stringify({
          company_id: companyId,
          txn_count: parsed.transactions?.length ?? 0,
        }),
      });
    }

    return NextResponse.json({ ...parsed, persist: persistResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
