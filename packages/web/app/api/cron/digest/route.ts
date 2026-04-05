import { verifyVeloCronRequest } from '@/lib/cron-auth';
import { runPlatformHealthcheck } from '@velo/tools/platform-health';
import { sendEmail } from '@velo/tools/email';
import { sendNotification } from '@velo/tools/notifications';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — scheduled ops digest (Slack + optional email).
 * Headers: `x-velo-cron-secret: $VELO_CRON_SECRET` or `Authorization: Bearer $VELO_CRON_SECRET`
 */
export async function POST(req: Request) {
  if (!process.env.VELO_CRON_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'VELO_CRON_SECRET is not set' },
      { status: 503 }
    );
  }
  if (!verifyVeloCronRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const companyId = process.env.VELO_COMPANY_ID?.trim() || 'demo-company';
    const report = await runPlatformHealthcheck();
    const op = report.operational_snapshot;
    const highlights: string[] = [
      report.summary,
      ...(op
        ? [
            `Pending approvals: ${op.pending_approvals.length}`,
            `Open AP: ${op.open_ap_payables} · AR overdue: ${op.ar_overdue}`,
            `HR blockers: ${op.hr_open_blockers} · Pending hires: ${op.hr_pending_hires}`,
          ]
        : []),
    ];

    const slack = await sendNotification({
      tool_id: 'notifications.send_digest',
      company_id: companyId,
      title: 'Velo scheduled digest',
      highlights,
    });

    const digestTo = process.env.VELO_DIGEST_EMAIL_TO?.trim();
    let email: Record<string, unknown> | null = null;
    if (digestTo) {
      email = await sendEmail({
        tool_id: 'email.digest',
        to: digestTo,
        subject: `[Velo] Ops digest — ${new Date().toISOString().slice(0, 10)}`,
        body: highlights.join('\n'),
      });
    }

    return NextResponse.json({
      ok: true,
      generated_at: report.generated_at,
      slack,
      email,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
