// Email tool — sends transactional emails via Resend.
// Falls back to console.log when RESEND_API_KEY is not configured (local dev).

import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendClient = new Resend(apiKey);
  return resendClient;
}

const FROM_ADDRESS =
  process.env.VELO_EMAIL_FROM ?? 'Velo <noreply@mail.velo.app>';

export async function sendEmail(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const to = String(params.to ?? '');
  const subject = String(params.subject ?? 'Velo notification');
  const htmlBody = buildEmailHtml(params);

  const client = getResendClient();

  if (!client) {
    // Dev fallback — log and return mock success
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
    return {
      ok: true,
      channel: 'email',
      to,
      subject,
      sent_at: new Date().toISOString(),
      mode: 'dev_no_send',
    };
  }

  try {
    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html: htmlBody,
    });

    return {
      ok: true,
      channel: 'email',
      to,
      subject,
      sent_at: new Date().toISOString(),
      message_id: result.data?.id ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] Send failed:', message);
    return {
      ok: false,
      channel: 'email',
      to,
      subject,
      error: message,
    };
  }
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(params: Record<string, unknown>): string {
  const toolId = String(params.tool_id ?? '');

  if (toolId === 'email.send_invoice') {
    return invoiceEmailHtml(params);
  }

  // Generic notification email
  const body = String(
    params.body ?? params.message ?? params.html ?? 'You have a notification from Velo.'
  );
  return genericEmailHtml(body);
}

function genericEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;background:#f4f4f4;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h2 style="margin-top:0;color:#111;">Velo</h2>
    <p style="color:#333;line-height:1.6;">${escapeHtml(body)}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="font-size:12px;color:#999;">Sent by Velo — your autonomous back-office OS.</p>
  </div>
</body>
</html>`;
}

function invoiceEmailHtml(params: Record<string, unknown>): string {
  const clientName = escapeHtml(String(params.client_name ?? 'Valued Client'));
  const invoiceId = escapeHtml(String(params.invoice_id ?? ''));
  const amount = Number(params.amount ?? 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
  const dueDate = escapeHtml(String(params.due_date ?? ''));
  const pdfUrl = escapeHtml(String(params.pdf_url ?? ''));

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;background:#f4f4f4;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h2 style="margin-top:0;color:#111;">Invoice ${invoiceId}</h2>
    <p style="color:#333;">Dear ${clientName},</p>
    <p style="color:#333;line-height:1.6;">
      Please find attached your invoice for <strong>${amount}</strong> due on <strong>${dueDate}</strong>.
    </p>
    ${pdfUrl ? `<p><a href="${pdfUrl}" style="background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Download Invoice</a></p>` : ''}
    <p style="color:#333;line-height:1.6;">
      Please arrange payment before the due date. For any queries, reply to this email.
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="font-size:12px;color:#999;">Sent by Velo — autonomous back-office OS.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
