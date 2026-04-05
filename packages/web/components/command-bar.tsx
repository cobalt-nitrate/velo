'use client';

import { ChangeEvent, FormEvent, useState } from 'react';

export function CommandBar() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          agentId: 'helpdesk',
          companyId: 'demo-company',
          actorId: 'demo-user',
          actorRole: 'founder',
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(String(data.error ?? res.statusText));
        return;
      }
      setResult(
        typeof data.output === 'string'
          ? data.output
          : JSON.stringify(data, null, 2)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-velo-line bg-velo-panel p-3">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={text}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setText(e.currentTarget.value)
          }
          placeholder="Ask Velo: What changed runway this week?"
          className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-velo-accent px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50"
          >
            {loading ? 'Running…' : 'Run agent'}
          </button>
          <span className="text-xs text-velo-muted">helpdesk · POST /api/chat</span>
        </div>
      </form>
      <div className="mt-2 flex gap-2 text-xs text-velo-muted">
        <span className="rounded bg-white/5 px-2 py-1">Runway simulation</span>
        <span className="rounded bg-white/5 px-2 py-1">Payroll exceptions</span>
        <span className="rounded bg-white/5 px-2 py-1">Compliance checklist</span>
      </div>
      {error && (
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-rose-500/10 p-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {result && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-2 text-xs text-velo-text">
          {result}
        </pre>
      )}
    </div>
  );
}
