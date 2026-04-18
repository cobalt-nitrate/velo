import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/users-registry';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { UserProfile } from '@/components/user-profile';

export const metadata = { title: 'Profile — Velo' };

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/auth/signin?callbackUrl=/profile');
  }

  const role = (session.user as { actor_role?: string }).actor_role ?? 'employee';
  const userRecord = await getUser(session.user.email);

  return (
    <main className="flex min-h-screen flex-col">
      <div className="border-b border-velo-line bg-velo-panel px-6 py-4">
        <h1 className="text-lg font-semibold text-velo-text">Profile</h1>
        <p className="mt-0.5 text-xs text-velo-muted">Your account details and session information.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <UserProfile
          email={session.user.email}
          name={session.user.name ?? null}
          image={session.user.image ?? null}
          role={role}
          firstSignIn={userRecord?.firstSignIn ?? null}
          lastSignIn={userRecord?.lastSignIn ?? null}
          sessionMaxAgeHours={8}
        />
      </div>
    </main>
  );
}
