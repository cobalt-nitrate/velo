/**
 * /onboarding — first-run setup wizard.
 *
 * Server component: reads session + onboarding state, applies the security gate,
 * then hands off to the OnboardingWizard client component.
 *
 * Security gates:
 *  1. Unauthenticated → redirect to /auth/signin
 *  2. Non-founder role → show "waiting for founder" screen (not a redirect loop)
 *  3. Onboarding already complete → redirect to /
 */

import { authOptions } from '@/lib/auth';
import { getOnboardingState } from '@/lib/onboarding-store';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '../../components/onboarding-wizard';

export const metadata = { title: 'Velo Setup' };

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  // Gate 1: must be authenticated
  if (!session?.user?.email) {
    redirect('/auth/signin?callbackUrl=/onboarding');
  }

  const role = (session.user as { actor_role?: string }).actor_role;

  // Gate 2: only founders run setup; others see a holding screen
  if (role !== 'founder') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-velo-bg p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-velo-accent/10 ring-1 ring-velo-accent/25">
          <span className="text-xl font-bold text-velo-accent">V</span>
        </div>
        <h1 className="text-lg font-semibold text-velo-text">Setup in progress</h1>
        <p className="max-w-sm text-sm text-velo-muted">
          Your workspace is being set up by your founder. You&apos;ll be able to log in once they complete the onboarding wizard.
        </p>
        <a
          href="/"
          className="mt-2 rounded-lg border border-velo-line px-4 py-2 text-sm text-velo-muted hover:text-velo-text"
        >
          Go to dashboard
        </a>
      </main>
    );
  }

  // Gate 3: already complete → send to dashboard
  const state = getOnboardingState();
  if (state.completed) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-velo-bg p-6 pt-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-velo-accent/10 ring-1 ring-velo-accent/25">
          <span className="text-xl font-bold text-velo-accent">V</span>
        </div>
        <h1 className="text-xl font-bold text-velo-text">Welcome to Velo</h1>
        <p className="mt-1 text-sm text-velo-muted">
          Let&apos;s connect your services — takes about 5 minutes.
        </p>
      </div>

      <OnboardingWizard
        initialStep={state.currentStep}
        initialBootstrapped={state.sheetsBootstrapped}
        currentUserEmail={session.user.email}
      />
    </main>
  );
}
