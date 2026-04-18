'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-velo-bg p-4">
      <div className="w-full max-w-sm rounded-2xl border border-velo-line bg-velo-panel p-8 shadow-shell">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-velo-accent/10 ring-1 ring-velo-accent/25">
            <span className="text-sm font-bold tracking-tight text-velo-accent">V</span>
          </div>
          <h1 className="text-lg font-semibold text-velo-text">Sign in to Velo</h1>
          <p className="mt-1 text-xs text-velo-muted">Back-office command center</p>
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
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-velo-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted outline-none focus:border-velo-accent focus:ring-1 focus:ring-velo-accent/30"
              placeholder="••••••••"
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-velo-muted">
          First time?{' '}
          <a href="/auth/setup" className="font-medium text-velo-accent hover:underline">
            Set up your founder account
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-velo-muted">
          Have an invite link?{' '}
          <span className="text-velo-text">Check your email for the invite URL.</span>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-velo-bg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-velo-accent border-t-transparent" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
