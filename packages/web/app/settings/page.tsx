'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Ui = {
  companyName: string;
  defaultAgentId: string;
  defaultCurrency: string;
  defaultActorRole: string;
};

type ConnectorFieldPayload = {
  envKey: string;
  label: string;
  sensitive?: boolean;
  multiline?: boolean;
  placeholder?: string;
  optional?: boolean;
  status: { effectiveSet: boolean; source: string };
  valueHint: string;
};

type ConnectorPayload = {
  id: string;
  title: string;
  summary: string;
  docsUrl?: string;
  steps: string[];
  ready: boolean;
  fields: ConnectorFieldPayload[];
};

type IntegrationsResponse = {
  ok: boolean;
  storagePath?: string;
  note?: string;
  connectors?: ConnectorPayload[];
  error?: string;
};

export default function SettingsPage() {
  const [ui, setUi] = useState<Ui | null>(null);
  const [companySettings, setCompanySettings] = useState<Array<Record<string, string>> | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsResponse | null>(null);
  const [connectorForm, setConnectorForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [connectorSaved, setConnectorSaved] = useState(false);
  const [connectorSaving, setConnectorSaving] = useState(false);
  const [testById, setTestById] = useState<Record<string, string | null>>({});

  const loadIntegrations = useCallback(async () => {
    const intRes = await fetch('/api/config/integrations');
    const intData = (await intRes.json()) as IntegrationsResponse;
    if (intData.ok && intData.connectors) {
      setIntegrations(intData);
      setFormFromConnectors(intData.connectors);
    } else {
      setIntegrations(intData.ok ? intData : { ok: false, error: intData.error });
    }
  }, []);

  function setFormFromConnectors(list: ConnectorPayload[]) {
    const next: Record<string, string> = {};
    for (const c of list) {
      for (const f of c.fields) {
        if (f.sensitive) next[f.envKey] = '';
        else next[f.envKey] = f.valueHint ?? '';
      }
    }
    setConnectorForm((prev) => ({ ...next, ...prev }));
  }

  useEffect(() => {
    (async () => {
      const [cfgRes, intRes] = await Promise.all([
        fetch('/api/config?company_settings=1'),
        fetch('/api/config/integrations'),
      ]);
      const data = (await cfgRes.json()) as {
        ui?: Ui;
        companySettingsRows?: Array<Record<string, string>> | null;
      };
      setUi(data.ui ?? null);
      setCompanySettings(data.companySettingsRows ?? null);
      const intData = (await intRes.json()) as IntegrationsResponse;
      if (intData.ok && intData.connectors) {
        setIntegrations(intData);
        setFormFromConnectors(intData.connectors);
      } else {
        setIntegrations(intData.ok ? intData : { ok: false, error: intData.error });
      }
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

  function buildConnectorPutBody(): Record<string, string> {
    const body: Record<string, string> = {};
    if (!integrations?.connectors) return body;
    for (const c of integrations.connectors) {
      for (const f of c.fields) {
        const raw = connectorForm[f.envKey] ?? '';
        const trimmed = raw.trim();
        if (f.sensitive) {
          if (trimmed) body[f.envKey] = raw;
        } else {
          body[f.envKey] = trimmed;
        }
      }
    }
    return body;
  }

  async function saveConnectors(e: FormEvent) {
    e.preventDefault();
    setConnectorSaving(true);
    setConnectorSaved(false);
    try {
      const res = await fetch('/api/config/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConnectorPutBody()),
      });
      const data = (await res.json()) as IntegrationsResponse;
      if (data.ok && data.connectors) {
        setIntegrations(data);
        setFormFromConnectors(data.connectors);
        setConnectorSaved(true);
      }
    } finally {
      setConnectorSaving(false);
    }
  }

  async function runTest(connectorId: string) {
    setTestById((m) => ({ ...m, [connectorId]: '…' }));
    try {
      const res = await fetch('/api/config/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: connectorId === 'auth' ? '' : connectorId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        probe_ok?: boolean;
        message?: string;
        error?: string;
      };
      const prefix =
        data.probe_ok === true ? 'OK — ' : data.probe_ok === false ? 'Failed — ' : '';
      const msg =
        prefix +
        (data.message ??
          data.error ??
          (res.ok ? JSON.stringify(data) : `HTTP ${res.status}`));
      setTestById((m) => ({ ...m, [connectorId]: msg }));
    } catch (err) {
      setTestById((m) => ({
        ...m,
        [connectorId]: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  if (loading || !ui) {
    return (
      <main className="p-6">
        <p className="text-sm text-velo-muted">Loading settings…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-velo-muted">
        Workspace preferences are stored locally in{' '}
        <code className="rounded bg-velo-inset-deep px-1 text-velo-text">.velo/ui-settings.json</code>.
        Connector credentials save to{' '}
        <code className="rounded bg-velo-inset-deep px-1 text-velo-text">.velo/connector-env.json</code>{' '}
        (gitignored) and load into the server on startup; saving below also applies immediately for this
        process.
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4">
        <label className="block text-sm">
          Company display name
          <input
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-3 py-2 text-sm"
            value={ui.companyName}
            onChange={(e) => setUi({ ...ui, companyName: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Default agent (new chats)
          <input
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-3 py-2 font-mono text-sm"
            value={ui.defaultAgentId}
            onChange={(e) => setUi({ ...ui, defaultAgentId: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Default actor role
          <select
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-3 py-2 text-sm"
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
            className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-3 py-2 text-sm"
            value={ui.defaultCurrency}
            onChange={(e) => setUi({ ...ui, defaultCurrency: e.target.value })}
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-velo-accent px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-velo-accent-hover"
        >
          Save preferences
        </button>
        {saved && <span className="ml-2 text-xs text-emerald-700">Saved</span>}
      </form>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Database · company_settings</h2>
        <p className="mt-1 text-sm text-velo-muted">
          Read-only snapshot of company_settings rows from PostgreSQL (via the data API).
        </p>
        {!companySettings || companySettings.length === 0 ? (
          <p className="mt-2 text-sm text-velo-muted">No rows returned.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-velo-line">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-velo-line bg-velo-panel-muted">
                  {Object.keys(companySettings[0]).map((k) => (
                    <th key={k} className="px-2 py-2 font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companySettings.map((row, i) => (
                  <tr key={i} className="border-b border-velo-line/80">
                    {Object.keys(companySettings[0]).map((k) => (
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

      <section className="mt-10 border-t border-velo-line pt-10">
        <h2 className="text-lg font-medium">Connectors</h2>
        <p className="mt-1 text-sm text-velo-muted">
          {integrations?.note ??
            'Configure integrations here or via `.env.local`. Host environment wins on server boot; the file fills any missing keys.'}
        </p>

        {!integrations?.connectors ? (
          <p className="mt-3 text-sm text-amber-800">
            {integrations?.error ?? 'Could not load connectors.'}
          </p>
        ) : (
          <form onSubmit={saveConnectors} className="mt-6 space-y-8">
            {integrations.connectors.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-velo-line bg-velo-panel/60 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-velo-text">{c.title}</h3>
                    <p className="mt-1 text-sm text-velo-muted">{c.summary}</p>
                    {c.docsUrl && (
                      <a
                        href={c.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-xs font-medium text-teal-700 underline decoration-teal-700/30 hover:decoration-teal-700"
                      >
                        Provider documentation →
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        c.ready
                          ? 'bg-emerald-500/15 text-emerald-800'
                          : 'bg-amber-500/15 text-amber-900'
                      }`}
                    >
                      {c.ready ? 'Minimum configured' : 'Incomplete'}
                    </span>
                    {(c.id === 'postgresql' ||
                      c.id === 'google_drive' ||
                      c.id === 'llm' ||
                      c.id === 'slack' ||
                      c.id === 'email') && (
                      <button
                        type="button"
                        onClick={() => runTest(c.id)}
                        className="rounded-md border border-velo-line bg-velo-inset-deep px-3 py-1.5 text-xs font-medium text-velo-text hover:bg-velo-panel"
                      >
                        Test connection
                      </button>
                    )}
                  </div>
                </div>

                {testById[c.id] != null && (
                  <p className="mt-3 rounded-md bg-velo-inset-deep px-3 py-2 font-mono text-[11px] text-velo-muted">
                    {testById[c.id]}
                  </p>
                )}

                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-velo-muted">
                  {c.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>

                <div className="mt-4 grid gap-4 sm:grid-cols-1">
                  {c.fields.map((f) => (
                    <label key={f.envKey} className="block text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        {f.label}
                        {f.optional && (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-velo-muted">
                            optional
                          </span>
                        )}
                        {f.status.effectiveSet ? (
                          <span className="text-[10px] text-emerald-700">
                            set
                            {f.status.source !== 'none' && f.status.source !== 'file'
                              ? ` (${f.status.source})`
                              : f.status.source === 'file'
                                ? ' (file)'
                                : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-velo-muted/80">empty</span>
                        )}
                      </span>
                      {f.multiline ? (
                        <textarea
                          className="mt-1 w-full min-h-[88px] rounded-md border border-velo-line bg-velo-panel px-3 py-2 font-mono text-xs"
                          autoComplete="off"
                          placeholder={
                            f.sensitive
                              ? f.placeholder ?? 'Leave blank to keep existing value'
                              : f.placeholder
                          }
                          value={connectorForm[f.envKey] ?? ''}
                          onChange={(e) =>
                            setConnectorForm((prev) => ({
                              ...prev,
                              [f.envKey]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <input
                          className="mt-1 w-full rounded-md border border-velo-line bg-velo-panel px-3 py-2 font-mono text-xs"
                          autoComplete={f.sensitive ? 'new-password' : 'off'}
                          type={f.sensitive ? 'password' : 'text'}
                          placeholder={
                            f.sensitive
                              ? f.placeholder ?? 'Leave blank to keep existing value'
                              : f.placeholder
                          }
                          value={connectorForm[f.envKey] ?? ''}
                          onChange={(e) =>
                            setConnectorForm((prev) => ({
                              ...prev,
                              [f.envKey]: e.target.value,
                            }))
                          }
                        />
                      )}
                      <span className="mt-0.5 block font-mono text-[10px] text-velo-muted/90">
                        {f.envKey}
                      </span>
                    </label>
                  ))}
                </div>
              </article>
            ))}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={connectorSaving}
                className="rounded-md bg-velo-accent px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-velo-accent-hover disabled:opacity-60"
              >
                {connectorSaving ? 'Saving…' : 'Save connectors'}
              </button>
              <button
                type="button"
                onClick={() => loadIntegrations()}
                className="rounded-md border border-velo-line px-3 py-2 text-sm text-velo-text hover:bg-velo-inset-deep"
              >
                Reload status
              </button>
              {connectorSaved && (
                <span className="text-xs text-emerald-700">Connectors saved</span>
              )}
            </div>
          </form>
        )}

        <div className="mt-8 rounded-lg border border-velo-line bg-velo-inset-deep/40 px-3 py-3 text-xs text-velo-muted">
          <p className="font-medium text-velo-text">Workflow API</p>
          <p className="mt-1 font-mono">
            POST /api/workflows/run — body:{' '}
            {`{ "workflowKey": "ap_invoice_processing", "context": { ... } }`}
          </p>
          <p className="mt-1 font-mono">
            POST /api/workflows/resume — body:{' '}
            {`{ "run_id": "…", "companyId": "…" }`} after approval is APPROVED
          </p>
          <p className="mt-1 font-mono">GET /api/workflows/runs?status=WAITING_FOR_APPROVAL</p>
          <p className="mt-2 font-medium text-velo-text">Cron</p>
          <p className="mt-1 font-mono">
            POST /api/cron/digest — header x-velo-cron-secret
          </p>
          <p className="mt-1 font-mono">
            POST /api/cron/escalate-approvals — expire stale PENDING rows + notify
          </p>
        </div>
      </section>

      <section className="mt-10 text-sm text-velo-muted">
        <h2 className="text-base font-medium text-velo-text">Production</h2>
        <p className="mt-2">
          Prefer host secrets (e.g. Vercel / Fly / Kubernetes) for production. The file store is ideal
          for local demos; restrict who can open this Settings page on a shared network.
        </p>
      </section>
    </main>
  );
}
