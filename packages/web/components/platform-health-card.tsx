'use client';

import { useEffect, useState } from 'react';

type HealthStatus = 'ok' | 'warn' | 'fail' | 'skipped';

interface HealthCheckRow {
  id: string;
  status: HealthStatus;
  message: string;
  detail?: string;
  ms?: number;
}

interface HealthPayload {
  generated_at: string;
  overall: HealthStatus;
  checks: HealthCheckRow[];
  summary: string;
}

function statusTone(s: HealthStatus): string {
  switch (s) {
    case 'ok':
      return 'text-emerald-400';
    case 'warn':
      return 'text-amber-400';
    case 'fail':
      return 'text-rose-400';
    default:
      return 'text-velo-muted';
  }
}

export function PlatformHealthCard() {
  const [report, setReport] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const data = (await res.json()) as HealthPayload;
        if (!cancelled) {
          setReport(data);
          setError(res.ok ? null : data.summary ?? `HTTP ${res.status}`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load health');
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="platform-health"
      className="rounded-xl border border-velo-line bg-velo-panel/60 px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-velo-muted">
            Platform health
          </h2>
          <p className="mt-1 text-xs text-velo-muted">
            Live checks from <code className="text-velo-text/80">GET /api/health</code> (same probes
            as the orchestrator tool).
          </p>
        </div>
        {report && (
          <span
            className={`rounded-md border border-velo-line px-2 py-0.5 text-xs font-medium capitalize ${statusTone(report.overall)}`}
          >
            {report.overall}
          </span>
        )}
      </div>

      {loading && (
        <p className="mt-3 animate-pulse text-velo-muted">Running integration probes…</p>
      )}
      {error && !report && (
        <p className="mt-3 text-rose-400" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <p className="mt-2 text-velo-text">{report.summary}</p>
          {error && (
            <p className="mt-1 text-xs text-amber-400" role="status">
              {error}
            </p>
          )}
          <p className="mt-1 text-xs text-velo-muted">
            Updated {new Date(report.generated_at).toLocaleString()}
          </p>
          {report.checks.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-velo-accent hover:underline">
                All checks ({report.checks.length})
              </summary>
              <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
                {report.checks.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-0.5 border-b border-velo-line/50 pb-2 last:border-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] text-velo-muted">{c.id}</span>
                      <span className={`font-medium capitalize ${statusTone(c.status)}`}>
                        {c.status}
                        {typeof c.ms === 'number' ? (
                          <span className="ml-1 font-normal text-velo-muted">({c.ms}ms)</span>
                        ) : null}
                      </span>
                    </div>
                    <span className="text-velo-text">{c.message}</span>
                    {c.detail ? (
                      <span className="text-velo-muted/90">{c.detail}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
