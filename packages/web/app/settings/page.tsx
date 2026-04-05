'use client';

import { FormEvent, useEffect, useState } from 'react';

type Ui = {
  companyName: string;
  defaultAgentId: string;
  defaultCurrency: string;
  defaultActorRole: string;
};

export default function SettingsPage() {
  const [ui, setUi] = useState<Ui | null>(null);
  const [sheets, setSheets] = useState<Array<Record<string, string>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/config?sheets=1');
      const data = (await res.json()) as {
        ui?: Ui;
        sheetsRows?: Array<Record<string, string>> | null;
      };
      setUi(data.ui ?? null);
      setSheets(data.sheetsRows ?? null);
      setLoading(false);
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ui) return;
    setSaved(false);
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ui),
    });
    const data = (await res.json()) as { ui?: Ui };
    if (data.ui) setUi(data.ui);
    setSaved(true);
  }

  if (loading || !ui) {
    return (
      <main className="p-6">
        <p className="text-sm text-velo-muted">Loading settings…</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-velo-muted">
        Workspace preferences are stored locally in <code className="rounded bg-white/5 px-1">.velo/ui-settings.json</code> — no spreadsheet editing required for these fields.
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4">
        <label className="block text-sm">
          Company display name
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            value={ui.companyName}
            onChange={(e) => setUi({ ...ui, companyName: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Default agent (new chats)
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm"
            value={ui.defaultAgentId}
            onChange={(e) => setUi({ ...ui, defaultAgentId: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Default actor role
          <select
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            value={ui.defaultActorRole}
            onChange={(e) => setUi({ ...ui, defaultActorRole: e.target.value })}
          >
            <option value="founder">founder</option>
            <option value="finance_lead">finance_lead</option>
            <option value="hr_lead">hr_lead</option>
            <option value="employee">employee</option>
          </select>
        </label>
        <label className="block text-sm">
          Default currency
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            value={ui.defaultCurrency}
            onChange={(e) => setUi({ ...ui, defaultCurrency: e.target.value })}
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-velo-accent px-4 py-2 text-sm font-medium text-black"
        >
          Save
        </button>
        {saved && (
          <span className="ml-2 text-xs text-emerald-300">Saved</span>
        )}
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Google Sheets · company_settings</h2>
        <p className="mt-1 text-sm text-velo-muted">
          Read-only snapshot from your CONFIG spreadsheet (when Sheets env is configured).
        </p>
        {!sheets || sheets.length === 0 ? (
          <p className="mt-2 text-sm text-velo-muted">No rows returned or Sheets not connected.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-velo-line">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-velo-line bg-white/5">
                  {Object.keys(sheets[0]).map((k) => (
                    <th key={k} className="px-2 py-2 font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheets.map((row, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Object.keys(sheets[0]).map((k) => (
                      <td key={k} className="px-2 py-1.5 text-velo-muted">
                        {row[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 text-sm text-velo-muted">
        <h2 className="text-base font-medium text-velo-text">Environment</h2>
        <p className="mt-2">
          API keys and spreadsheet IDs stay in <code className="rounded bg-white/5 px-1">.env.local</code> — use your host or deployment secrets for production.
        </p>
      </section>
    </main>
  );
}
