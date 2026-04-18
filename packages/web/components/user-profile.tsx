'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder',
  finance_lead: 'Finance Lead',
  hr_lead: 'HR Lead',
  manager: 'Manager',
  employee: 'Employee',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  founder: 'Full access to all modules, settings, and team management.',
  finance_lead: 'Access to AP/AR, compliance, and financial operations.',
  hr_lead: 'Access to HR operations, payroll, and employee management.',
  manager: 'Access to operations and team data. Cannot modify settings.',
  employee: 'Access to chat and self-service features.',
};

interface UserProfileProps {
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  firstSignIn: string | null;
  lastSignIn: string | null;
  sessionMaxAgeHours: number;
}

function Avatar({ name, image, fallbackEmail }: { name: string | null; image: string | null; fallbackEmail: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name ?? 'User'} className="h-16 w-16 rounded-full object-cover ring-2 ring-velo-accent/20" referrerPolicy="no-referrer" />;
  }
  const initials = (name ?? fallbackEmail).split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-velo-accent/15 text-xl font-bold text-velo-accent ring-2 ring-velo-accent/20">
      {initials}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Badge({ role }: { role: string }) {
  const colours: Record<string, string> = {
    founder: 'bg-velo-accent/15 text-velo-accent',
    finance_lead: 'bg-blue-500/15 text-blue-600',
    hr_lead: 'bg-purple-500/15 text-purple-600',
    manager: 'bg-amber-500/15 text-amber-700',
    employee: 'bg-velo-inset text-velo-muted',
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${colours[role] ?? colours.employee}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export function UserProfile({
  email,
  name,
  image,
  role,
  firstSignIn,
  lastSignIn,
  sessionMaxAgeHours,
}: UserProfileProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: '/auth/signin' });
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Identity card */}
      <section className="rounded-xl border border-velo-line bg-velo-panel p-6">
        <div className="flex items-start gap-4">
          <Avatar name={name} image={image} fallbackEmail={email} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-velo-text">{name ?? email}</h2>
            <p className="mt-0.5 truncate text-sm text-velo-muted">{email}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge role={role} />
            </div>
          </div>
        </div>

        {/* Role description */}
        <p className="mt-4 rounded-lg bg-velo-inset px-3 py-2.5 text-xs text-velo-muted">
          {ROLE_DESCRIPTIONS[role] ?? 'Standard access.'}
        </p>
      </section>

      {/* Session info (V1-011) */}
      <section className="rounded-xl border border-velo-line bg-velo-panel p-6">
        <h3 className="mb-4 text-sm font-semibold text-velo-text">Session & access</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-velo-muted">First sign-in</dt>
            <dd className="text-right font-medium text-velo-text">{formatDate(firstSignIn)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-velo-muted">Last sign-in</dt>
            <dd className="text-right font-medium text-velo-text">{formatDate(lastSignIn)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-velo-muted">Session lifetime</dt>
            <dd className="text-right font-medium text-velo-text">{sessionMaxAgeHours} hours</dd>
          </div>
        </dl>

        <div className="mt-4 rounded-lg border border-velo-line/60 bg-velo-inset/50 px-3 py-2.5">
          <p className="text-[11px] text-velo-muted leading-relaxed">
            Sessions expire after {sessionMaxAgeHours} hours of inactivity. If a founder changes your role,
            the new role will apply within {sessionMaxAgeHours} hours without requiring you to sign out.
            Revocation takes effect immediately on your next page load.
          </p>
        </div>

        <div className="mt-4 border-t border-velo-line pt-4">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="rounded-lg border border-red-300/50 bg-red-50/10 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50/20 disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign out of this device'}
          </button>
          <p className="mt-2 text-[11px] text-velo-muted">
            This signs you out on the current browser only. Other active sessions will expire naturally.
          </p>
        </div>
      </section>
    </div>
  );
}
