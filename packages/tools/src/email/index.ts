export async function sendEmail(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return {
    ok: true,
    channel: 'email',
    to: params.to ?? null,
    subject: params.subject ?? 'Velo notification',
    sent_at: new Date().toISOString(),
  };
}
