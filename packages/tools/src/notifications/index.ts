export async function sendNotification(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return {
    ok: true,
    channel: params.channel ?? 'in_app',
    title: params.title ?? 'Approval required',
    message: params.message ?? '',
    sent_at: new Date().toISOString(),
  };
}
