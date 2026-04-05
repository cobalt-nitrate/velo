import { runPlatformHealthcheck } from '@velo/tools/platform-health';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * GET /api/health — structured platform integration status (Sheets, Drive, LLM, approvals).
 * Read-only; same probes as `internal.platform.healthcheck` for agents.
 */
export async function GET() {
  try {
    const report = await runPlatformHealthcheck();
    const http =
      report.overall === 'fail' ? 503 : report.overall === 'warn' ? 200 : 200;
    return NextResponse.json(report, { status: http });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        generated_at: new Date().toISOString(),
        overall: 'fail',
        summary: message,
        checks: [],
      },
      { status: 500 }
    );
  }
}
