import { executeSheetTool } from '@velo/tools/sheets';
import { getUiSettings, setUiSettings, type UiSettings } from '@/lib/local-settings';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** UI + workspace settings (local JSON). Optional ?sheets=1 pulls company_settings rows. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ui = getUiSettings();
  let sheetsRows: Array<Record<string, string>> | null = null;

  if (searchParams.get('sheets') === '1') {
    try {
      const res = await executeSheetTool({
        tool_id: 'sheets.company_settings.lookup',
        company_id: 'demo-company',
      });
      const rows = (res as { rows?: Array<Record<string, string>> }).rows;
      sheetsRows = rows ?? [];
    } catch {
      sheetsRows = [];
    }
  }

  return NextResponse.json({ ok: true, ui, sheetsRows });
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Partial<UiSettings>;
    const ui = setUiSettings(body);
    return NextResponse.json({ ok: true, ui });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
