import { authOptions } from '@/lib/auth';
import { TeamManagement } from '@/components/team-management';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Team — Velo' };

export default async function TeamPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth/signin?callbackUrl=/team');
  }

  const role = (session.user as { actor_role?: string }).actor_role;

  if (role !== 'founder') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-xl border border-velo-line bg-velo-panel p-8 max-w-sm">
          <div className="mb-3 text-3xl">🔒</div>
          <h1 className="mb-2 text-base font-semibold text-velo-text">Founders only</h1>
          <p className="text-sm text-velo-muted">
            Team management is restricted to founders. Contact your admin if you need access.
          </p>
          <a href="/" className="mt-4 inline-block text-sm font-medium text-velo-accent hover:underline">
            ← Back to dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="border-b border-velo-line bg-velo-panel px-6 py-4">
        <h1 className="text-lg font-semibold text-velo-text">Team</h1>
        <p className="mt-0.5 text-xs text-velo-muted">
          Manage who has access to Velo and what they can do.
          Role changes take effect on the member&apos;s next sign-in (within 8 hours).
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <TeamManagement currentUserEmail={session.user.email} />
      </div>
    </main>
  );
}
