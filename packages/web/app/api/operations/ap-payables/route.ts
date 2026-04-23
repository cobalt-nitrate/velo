import { executeDataTool } from '@velo/tools/data';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** All open AP invoice rows (pending payables), same filter as agent tool. */
export async function GET() {
  try {
    const result = await executeDataTool({
      tool_id: 'data.ap_invoices.get_pending_payables',
      company_id: '',
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
