'use client';

import { FormEvent, useState } from 'react';

export function PolicyCopilot() {
  const [threshold, setThreshold] = useState(25000);
  const [toolId, setToolId] = useState('data.ap_invoices.create');
  const [confidence, setConfidence] = useState(0.82);
  const [amount, setAmount] = useState(40000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onSimulate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/policy/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          confidence,
          amount_inr: amount,
          payment_auto_threshold_inr: threshold,
          actor_role: 'founder',
          agent_id: 'ap-invoice',
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      setResult(JSON.stringify(data, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-velo-line bg-velo-panel p-4">
      <h3 className="text-base font-semibold">Policy copilot</h3>
      <p className="mt-2 text-sm text-velo-muted">
        Simulate policy routing for a hypothetical tool call.
      </p>
      <form onSubmit={onSimulate} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          AP auto limit (INR)
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          Confidence (0–1)
          <input
            type="number"
            step="0.01"
            min={0}
            max={1}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-2 py-1.5"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Tool id
          <input
            type="text"
            value={toolId}
            onChange={(e) => setToolId(e.target.value)}
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Amount INR (for payment threshold rule)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-2 py-1.5"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-velo-accent px-3 py-1.5 text-sm font-medium text-white shadow-soft hover:bg-velo-accent-hover disabled:opacity-50"
          >
            {loading ? 'Simulating…' : 'Simulate impact'}
          </button>
        </div>
      </form>
      {result && (
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-velo-line bg-velo-inset p-2 text-xs text-velo-text">
          {result}
        </pre>
      )}
    </section>
  );
}
