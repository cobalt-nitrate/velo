'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  finance_lead: 'Finance Lead',
  hr_lead: 'HR Lead',
  manager: 'Manager',
  employee: 'Employee',
};

interface InviteInfo {
  role: string;
  email: string | null;
  note: string | null;
  expiresAt: string;
}

function InvitePage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setInviteError('No invite token provided.'); return; }
    if (!/^[0-9a-f]{64}$/.test(token)) { setInviteError('Invalid invite link.'); return; }

    fetch(`/api/team/invites/${token}`)
      .then((r) => r.json())
      .then((data: { ok: boolean; invite?: InviteInfo; error?: string }) => {
        if (!data.ok) { setInviteError(data.error ?? 'Invite not found.'); }
        else {
          setInvite(data.invite ?? null);
          // Pre-fill email if the invite is scoped
          if (data.invite?.email) setEmail(data.invite.email);
        }
      })
      .catch(() => setInviteError('Network error. Please try again.'));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (password !== confirm) { setFormError('Passwords do not match.'); return; }
    if (password.length < 10) { setFormError('Password must be at least 10 characters.'); return; }

    // If invite is email-scoped, email field is locked — use it directly
    const resolvedEmail = invite?.email ?? email.trim().toLowerCase();
    if (!resolvedEmail) { setFormError('Email is required.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/invites/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resolvedEmail, name: name.trim() || null, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setFormError(data.error ?? 'Failed to create account.');
        setSubmitting(false);
        return;
      }

      // Auto sign-in
      const result = await signIn('credentials', {
        email: resolvedEmail,
        password,
        redirect: false,
      });

      if (result?.error) {
        setFormError('Account created but sign-in failed. Try signing in manually.');
        setSubmitting(false);
        return;
      }

      setDone(true);
      setTimeout(() => router.push('/'), 1500);
    } catch {
      setFormError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  if (!token || inviteError) {
    return <ErrorCard message={inviteError ?? 'Invalid invite link.'} />;
  }

  if (!invite && !inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-velo-bg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-velo-accent border-t-transparent" />
      </div>
    );
  }

  if (done) {
    return (
      <Card>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/30 text-2xl">✓</div>
        <h1 className="text-base font-semibold text-velo-text">Welcome to Velo!</h1>
        <p className="text-sm text-velo-muted">Your account is ready. Redirecting to the dashboard…</p>
      </Card>
    );
  }

  const roleName = ROLE_LABELS[invite!.role] ?? invite!.role;
  const emailLocked = !!invite!.email;

  return (
    <Card>
      <h1 className="text-base font-semibold text-velo-text">You&apos;ve been invited to Velo</h1>

      <div className="w-full rounded-lg border border-velo-line bg-velo-inset px-4 py-3 text-left text-sm space-y-1">
        <p>
          <span className="font-medium text-velo-muted">Role: </span>
          <span className="font-semibold text-velo-text">{roleName}</span>
        </p>
        {invite!.note && (
          <p>
            <span className="font-medium text-velo-muted">Note: </span>
            <span className="text-velo-text">{invite!.note}</span>
          </p>
        )}
        <p className="text-[11px] text-velo-muted">
          Expires {new Date(invite!.expiresAt).toLocaleString()}
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-3">
        <div>
          <label htmlFor="email" className="mb-1 block text-xs font-medium text-velo-muted">Email</label>
          <input
            id="email"
            type="email"
            required
            disabled={emailLocked}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30 disabled:opacity-60"
            placeholder="you@company.com"
          />
          {emailLocked && (
            <p className="mt-0.5 text-[11px] text-velo-muted">
              This invite is restricted to this email address.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="mb-1 block text-xs font-medium text-velo-muted">Your name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
            placeholder="Your name (optional)"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-xs font-medium text-velo-muted">
            Password <span className="text-velo-muted">(min 10 characters)</span>
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
            placeholder="••••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1 block text-xs font-medium text-velo-muted">Confirm password</label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
            placeholder="••••••••••"
          />
        </div>

        {formError && (
          <p className="rounded-lg border border-red-400/30 bg-red-50/10 px-3 py-2 text-xs text-red-500">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-velo-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-velo-accent/90 disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : `Create account & join as ${roleName}`}
        </button>
      </form>

      <p className="text-xs text-velo-muted">
        Already have an account?{' '}
        <a href="/auth/signin" className="font-medium text-velo-accent hover:underline">Sign in</a>
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-velo-bg p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-velo-line bg-velo-panel p-8 text-center shadow-shell">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-velo-accent/10 ring-1 ring-velo-accent/25">
          <span className="text-sm font-bold tracking-tight text-velo-accent">V</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <h1 className="text-base font-semibold text-velo-text">Invite unavailable</h1>
      <p className="text-sm text-velo-muted">{message}</p>
      <a href="/auth/signin" className="text-sm font-medium text-velo-accent hover:underline">Go to sign in</a>
    </Card>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-velo-bg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-velo-accent border-t-transparent" />
      </div>
    }>
      <InvitePage />
    </Suspense>
  );
}
