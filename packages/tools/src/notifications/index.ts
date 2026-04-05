// Notification dispatcher — sends via Slack and/or in-app.
// Falls back to console.log in dev when SLACK_BOT_TOKEN is absent.
// Each notification type has its own Slack Block Kit template.

type SlackBlock =
  | { type: 'section'; text: { type: 'mrkdwn' | 'plain_text'; text: string } }
  | { type: 'divider' }
  | { type: 'actions'; elements: Array<{ type: 'button'; text: { type: 'plain_text'; text: string }; url?: string; action_id?: string; style?: 'primary' | 'danger' }> }
  | { type: 'context'; elements: Array<{ type: 'mrkdwn'; text: string }> }
  | { type: 'header'; text: { type: 'plain_text'; text: string } };

async function postToSlack(
  channel: string,
  text: string,
  blocks: SlackBlock[]
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log(`[slack:dev] #${channel}: ${text}`);
    return { ok: true, ts: `dev_${Date.now()}` };
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text, blocks }),
  });

  const data = (await res.json()) as { ok: boolean; ts?: string; error?: string };
  if (!data.ok) {
    console.error('[slack] Post failed:', data.error);
  }
  return data;
}

// ─── Channel resolver ─────────────────────────────────────────────────────────
// Channels can be configured via env vars or default to sensible names.

function resolveChannel(notificationType: string): string {
  const channelMap: Record<string, string> = {
    approval: process.env.SLACK_CHANNEL_APPROVALS ?? '#approvals',
    compliance: process.env.SLACK_CHANNEL_COMPLIANCE ?? '#compliance',
    digest: process.env.SLACK_CHANNEL_DIGEST ?? '#weekly-digest',
    hr: process.env.SLACK_CHANNEL_HR ?? '#hr-ops',
    ar: process.env.SLACK_CHANNEL_AR ?? '#finance',
    general: process.env.SLACK_CHANNEL_GENERAL ?? '#velo-alerts',
  };
  return channelMap[notificationType] ?? channelMap.general;
}

// ─── Block Kit builders ───────────────────────────────────────────────────────

function approvalBlocks(params: Record<string, unknown>): SlackBlock[] {
  const title = String(params.title ?? 'Action requires approval');
  const message = String(params.message ?? '');
  const confidence = Number(params.confidence_score ?? 0);
  const approvalId = String(params.approval_id ?? '');
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const approveUrl = `${appUrl}/api/approvals/${approvalId}`;
  const reviewPage = `${appUrl}/approvals/${approvalId}`;

  const confidenceEmoji = confidence >= 0.85 ? '🟢' : confidence >= 0.60 ? '🟡' : '🔴';

  return [
    { type: 'header', text: { type: 'plain_text', text: `⏳ ${title}` } },
    { type: 'section', text: { type: 'mrkdwn', text: message || '_No details provided._' } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${confidenceEmoji} *Confidence:* ${(confidence * 100).toFixed(0)}%   |   *Approval ID:* \`${approvalId}\``,
      },
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Approve' },
          style: 'primary',
          url: `${reviewPage}?resolve=approved`,
          action_id: `approve_${approvalId}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '❌ Reject' },
          style: 'danger',
          url: `${reviewPage}?resolve=rejected`,
          action_id: `reject_${approvalId}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Details' },
          url: reviewPage,
          action_id: `view_${approvalId}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `Sent by Velo · <${approveUrl}|Open in Velo>` },
      ],
    },
  ];
}

function complianceAlertBlocks(params: Record<string, unknown>): SlackBlock[] {
  const label = String(params.label ?? 'Compliance deadline');
  const dueDate = String(params.due_date ?? '');
  const amount = Number(params.amount_inr ?? 0);
  const daysLeft = Number(params.days_left ?? 0);
  const urgencyEmoji = daysLeft <= 2 ? '🚨' : daysLeft <= 7 ? '⚠️' : 'ℹ️';
  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  return [
    { type: 'header', text: { type: 'plain_text', text: `${urgencyEmoji} Compliance Alert` } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${label}* is due on *${dueDate}* (${daysLeft} day${daysLeft !== 1 ? 's' : ''} away)\n${amount > 0 ? `Estimated amount: *₹${amount.toLocaleString('en-IN')}*` : ''}`,
      },
    },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'View Compliance Calendar' }, url: `${appUrl}/compliance`, action_id: 'view_calendar' },
      ],
    },
  ];
}

function digestBlocks(params: Record<string, unknown>): SlackBlock[] {
  const title = String(params.title ?? 'Weekly Velo Digest');
  const highlights = Array.isArray(params.highlights) ? params.highlights as string[] : [];

  const highlightText = highlights.length > 0
    ? highlights.map((h) => `• ${h}`).join('\n')
    : '_No highlights this week._';

  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

  return [
    { type: 'header', text: { type: 'plain_text', text: `📊 ${title}` } },
    { type: 'section', text: { type: 'mrkdwn', text: highlightText } },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open Command Center' }, url: appUrl, action_id: 'open_velo', style: 'primary' },
      ],
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Sent by Velo · ${new Date().toLocaleDateString('en-IN')}` }] },
  ];
}

function secureLinkBlocks(params: Record<string, unknown>): SlackBlock[] {
  const docType = String(params.document_type ?? 'document');
  const link = String(params.link ?? '');
  const expiryHours = Number(params.expiry_hours ?? 24);
  const employeeId = String(params.employee_id ?? '');

  return [
    { type: 'header', text: { type: 'plain_text', text: `📄 Your ${docType} is ready` } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hi${employeeId ? ` <@${employeeId}>` : ''}! Your *${docType}* download link is ready.\n\nThis link expires in *${expiryHours} hours*.`,
      },
    },
    link ? {
      type: 'actions',
      elements: [{ type: 'button', text: { type: 'plain_text', text: `Download ${docType}` }, url: link, style: 'primary', action_id: 'download_doc' }],
    } : { type: 'divider' } as SlackBlock,
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Sent securely by Velo. Do not share this link.' }] },
  ];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function sendNotification(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const toolId = String(params.tool_id ?? '');
  const channelOverride = String(params.channel ?? '');

  let blocks: SlackBlock[] = [];
  let channel = '';
  let text = '';

  if (toolId === 'notifications.send_approval_request') {
    channel = channelOverride || resolveChannel('approval');
    text = String(params.title ?? 'Action requires your approval in Velo');
    blocks = approvalBlocks(params);
  } else if (toolId === 'notifications.send_compliance_alert') {
    channel = channelOverride || resolveChannel('compliance');
    text = `Compliance alert: ${params.label ?? 'deadline approaching'}`;
    blocks = complianceAlertBlocks(params);
  } else if (toolId === 'notifications.send_digest') {
    channel = channelOverride || resolveChannel('digest');
    text = String(params.title ?? 'Weekly Velo Digest');
    blocks = digestBlocks(params);
  } else if (toolId === 'notifications.send_secure_link') {
    // Direct message to the employee — use their Slack ID if available,
    // else fall back to a designated HR/payroll channel
    channel = channelOverride ||
      (params.slack_user_id ? `@${params.slack_user_id}` : resolveChannel('hr'));
    text = `Your ${params.document_type ?? 'document'} is ready`;
    blocks = secureLinkBlocks(params);
  } else if (toolId === 'notifications.send_ar_reminder') {
    channel = channelOverride || resolveChannel('ar');
    text = `AR follow-up: ${params.client_name ?? 'client'} — ${params.amount_inr ? `₹${Number(params.amount_inr).toLocaleString('en-IN')}` : 'amount pending'}`;
    blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `*AR Follow-up Required*\nClient: *${params.client_name ?? 'Unknown'}*\nInvoice: ${params.invoice_id ?? ''}\nAmount: ₹${Number(params.amount_inr ?? 0).toLocaleString('en-IN')}\nDays overdue: *${params.days_overdue ?? 'N/A'}*` } },
    ];
  } else if (toolId === 'notifications.send_alert') {
    channel = channelOverride || resolveChannel('general');
    text = String(params.title ?? params.message ?? 'Velo alert');
    blocks = [
      { type: 'header', text: { type: 'plain_text', text: `⚡ ${String(params.title ?? 'Alert')}` } },
      { type: 'section', text: { type: 'mrkdwn', text: String(params.message ?? params.body ?? '_No details._') } },
    ];
  } else if (toolId === 'notifications.send_onboarding_link') {
    channel = channelOverride || resolveChannel('hr');
    text = `Onboarding link for ${params.employee_name ?? 'new joiner'}`;
    const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `*Complete your onboarding*\n${String(params.message ?? 'Use the link below to finish setup.')}` } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open onboarding' },
            url: String(params.link_url ?? appUrl),
            style: 'primary',
          },
        ],
      },
    ];
  } else if (toolId === 'notifications.send_leave_notification') {
    channel = channelOverride || resolveChannel('hr');
    text = `Leave update: ${params.employee_name ?? ''}`;
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Leave ${String(params.event ?? 'update')}*\nEmployee: *${params.employee_name ?? '—'}*\nDates: ${params.from_date ?? ''} → ${params.to_date ?? ''}\nStatus: *${params.status ?? 'pending'}*`,
        },
      },
    ];
  } else {
    // Generic notification
    channel = channelOverride || resolveChannel('general');
    text = String(params.message ?? params.title ?? 'Notification from Velo');
    blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: text } },
    ];
  }

  const result = await postToSlack(channel, text, blocks);

  return {
    ok: result.ok,
    channel: result.ok ? 'slack' : 'failed',
    slack_channel: channel,
    slack_ts: result.ts ?? null,
    title: text,
    sent_at: new Date().toISOString(),
    ...(result.error ? { error: result.error } : {}),
  };
}
