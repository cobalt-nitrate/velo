import type { ApprovalRequest } from '@velo/core/types';
import { sendEmail } from '@velo/tools/email';
import { sendNotification } from '@velo/tools/notifications';

/**
 * Wave 2 — fire Slack (+ optional email) when an approval row is created.
 * Does not block the agent if a channel fails.
 */
export async function notifyApprovalRequestOutOfBand(
  req: ApprovalRequest,
  companyId: string
): Promise<void> {
  const title = req.proposed_action_text || `Approve: ${req.action_type}`;
  const message = [
    `Agent: ${req.agent_id}`,
    `Action: ${req.action_type}`,
    `Confidence: ${(Number(req.confidence_score) * 100).toFixed(0)}%`,
  ].join('\n');

  try {
    await sendNotification({
      tool_id: 'notifications.send_approval_request',
      company_id: companyId,
      approver_role: req.approver_role,
      approval_id: req.approval_id,
      title,
      message,
      confidence_score: req.confidence_score,
    });
  } catch {
    /* non-fatal */
  }

  const to = process.env.VELO_APPROVAL_EMAIL_TO?.trim();
  if (!to) return;

  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const reviewUrl = `${appUrl}/approvals/${encodeURIComponent(req.approval_id)}`;
  const body = [
    `An action needs your approval in Velo.`,
    ``,
    `${title}`,
    ``,
    `${message}`,
    ``,
    `Review: ${reviewUrl}`,
  ].join('\n');

  try {
    await sendEmail({
      tool_id: 'email.approval_digest',
      to,
      subject: `[Velo] Approval required — ${req.approval_id}`,
      body,
    });
  } catch {
    /* non-fatal */
  }
}
