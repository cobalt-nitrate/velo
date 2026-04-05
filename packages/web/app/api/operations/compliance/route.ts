import { executeSheetTool } from '@velo/tools/sheets';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compliance obligations due in the next 60 days (not done), same filter as healthcheck. */
export async function GET() {
  try {
    const result = await executeSheetTool({
      tool_id: 'sheets.compliance_calendar.get_upcoming_obligations',
      company_id: '',
      days_ahead: 60,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
