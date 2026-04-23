'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function FounderSetupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/setup-founder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim(), password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setError(data.error ?? 'Setup failed.');
        setLoading(false);
        return;
      }

      // Auto sign-in after account creation
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but sign-in failed. Try signing in manually.');
        setLoading(false);
        return;
      }

      router.push('/onboarding');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-velo-bg p-4">
      <div className="w-full max-w-sm rounded-2xl border border-velo-line bg-velo-panel p-8 shadow-shell">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-velo-accent/10 ring-1 ring-velo-accent/25">
            <span className="text-sm font-bold tracking-tight text-velo-accent">V</span>
          </div>
          <h1 className="text-lg font-semibold text-velo-text">Create your founder account</h1>
          <p className="mt-1 text-xs text-velo-muted">
            One-time setup. This page only works before any users exist.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-velo-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-velo-muted">
              Display name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-velo-muted">
              Password <span className="text-velo-muted">(min 10 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
              placeholder="••••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1 block text-xs font-medium text-velo-muted">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
              placeholder="••••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/30 bg-red-50/10 px-3 py-2 text-xs text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-velo-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-velo-accent/90 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account & continue'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-velo-muted">
          Already have an account?{' '}
          <a href="/auth/signin" className="font-medium text-velo-accent hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
