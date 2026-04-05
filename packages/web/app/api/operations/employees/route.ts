import { executeSheetTool } from '@velo/tools/sheets';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Active employee rows from employees sheet (`get_active`). */
export async function GET() {
  try {
    const result = await executeSheetTool({
      tool_id: 'sheets.employees.get_active',
      company_id: '',
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
