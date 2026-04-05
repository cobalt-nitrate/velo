'use client';

import { signIn } from 'next-auth/react';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-velo-bg">
      <div className="w-full max-w-sm rounded-2xl border border-velo-line bg-velo-panel p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-velo-text">Velo</h1>
        <p className="mb-8 text-sm text-velo-muted">Sign in to your back-office command center</p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full rounded-lg bg-velo-accent px-4 py-3 text-sm font-semibold text-black hover:opacity-90"
        >
          Sign in with Google
        </button>
        <p className="mt-4 text-xs text-velo-muted">
          Access restricted to authorized company accounts.
        </p>
      </div>
    </main>
  );
}
