import { executeSheetTool } from '@velo/tools/sheets';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recent bank_transactions rows (newest first), same as agent tool. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)));
    const result = await executeSheetTool({
      tool_id: 'sheets.bank_transactions.get_recent',
      company_id: '',
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
