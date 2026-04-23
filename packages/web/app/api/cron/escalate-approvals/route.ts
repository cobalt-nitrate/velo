import { verifyVeloCronRequest } from '@/lib/cron-auth';
import { expireStalePendingApprovals } from '@velo/tools/data';
import { sendEmail } from '@velo/tools/email';
import { sendNotification } from '@velo/tools/notifications';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST — expire PENDING approvals past `expires_at`, then notify ops (Slack + optional email).
 * Same auth as `/api/cron/digest`.
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
    const { count, approval_ids } = await expireStalePendingApprovals();
    const companyId = process.env.VELO_COMPANY_ID?.trim() || 'demo-company';

    let slack: Record<string, unknown> | null = null;
    let email: Record<string, unknown> | null = null;

    if (count > 0) {
      const body = `The following approvals expired without action and were marked EXPIRED:\n${approval_ids.map((id) => `• ${id}`).join('\n')}`;
      slack = await sendNotification({
        tool_id: 'notifications.send_alert',
        company_id: companyId,
        title: 'Velo — expired approvals',
        message: body,
      });

      const escalateTo = process.env.VELO_DIGEST_EMAIL_TO?.trim();
      if (escalateTo) {
        email = await sendEmail({
          tool_id: 'email.escalation',
          to: escalateTo,
          subject: `[Velo] ${count} approval(s) auto-expired`,
          body,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      expired_count: count,
      approval_ids,
      slack,
      email,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
