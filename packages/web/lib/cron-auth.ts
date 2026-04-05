/** Shared guard for scheduled jobs (Vercel cron, GitHub Actions, etc.). */

export function verifyVeloCronRequest(req: Request): boolean {
  const secret = process.env.VELO_CRON_SECRET?.trim();
  if (!secret) return false;
  const header =
    req.headers.get('x-velo-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')?.trim();
  return Boolean(header && header === secret);
}
