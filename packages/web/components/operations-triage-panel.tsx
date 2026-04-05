'use client';

import type { HealthStatus } from '@velo/tools/platform-health';
import { saveOperationsChatHandoff } from '@/lib/operations-chat-handoff';
import type { OpsTriageDomain, OperationsTriageResponse } from '@/lib/operations-triage';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

function statusStyles(s: HealthStatus): string {
  switch (s) {
    case 'ok':
      return 'bg-emerald-50 text-emerald-900 ring-emerald-200';
    case 'warn':
      return 'bg-amber-50 text-amber-950 ring-amber-200';
    case 'fail':
      return 'bg-rose-50 text-rose-900 ring-rose-200';
    case 'skipped':
    default:
      return 'bg-velo-inset text-velo-muted ring-velo-line';
  }
}

function statusVerb(s: HealthStatus, optional?: boolean): string {
  if (optional && s === 'skipped') return 'Optional';
  switch (s) {
    case 'ok':
      return 'Available';
    case 'warn':
      return 'Degraded';
    case 'fail':
      return 'Unavailable';
    case 'skipped':
      return 'Not configured';
    default:
      return s;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  domain: OpsTriageDomain;
  row: Record<string, unknown> | null;
};

export function OperationsTriagePanel({ open, onClose, domain, row }: Props) {
  const router = useRouter();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OperationsTriageResponse | null>(null);

  const fetchTriage = useCallback(async () => {
    if (!row) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/operations/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, row }),
      });
      const json = (await res.json()) as OperationsTriageResponse & { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [domain, row]);

  useEffect(() => {
    if (!open || !row) return;
    void fetchTriage();
  }, [open, row, fetchTriage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-velo-line bg-velo-panel shadow-card sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-velo-line px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-velo-muted/90">
              AI triage
            </p>
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold tracking-tight text-velo-text">
              {domain.replace(/_/g, ' ')}
            </h2>
            <p className="mt-1 text-xs text-velo-muted">
              Business stake for this row, what it represents, next steps, agents, and live connector status.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-velo-line px-2.5 py-1 text-xs font-medium text-velo-muted hover:bg-velo-inset hover:text-velo-text"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-sm text-velo-muted">Generating triage summary…</p>
          )}
          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          )}
          {data && !loading && (
            <div className="space-y-6">
              <section className="rounded-lg border border-velo-accent/25 bg-velo-accent/[0.06] px-3 py-3 ring-1 ring-velo-accent/15">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-velo-accent/95">
                  Business stake — this row
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-velo-text/95">
                  {data.triage.business_context}
                </p>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  What this row means
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-velo-text/95">
                  {data.triage.what_it_means}
                </p>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  What to do next
                </h3>
                <ol className="mt-2 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-velo-text/95">
                  {data.triage.recommended_actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  Agents
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.agents_resolved.map((a) => (
                    <li
                      key={a.agent_id}
                      className="rounded-lg border border-velo-line bg-velo-inset px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-velo-text">{a.label}</span>
                        <code className="text-[10px] text-velo-muted/90">{a.agent_id}</code>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-velo-muted">{a.why}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                  Integrations (live workspace)
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.integrations.map((int) => (
                    <li
                      key={int.id}
                      className="flex gap-3 rounded-lg border border-velo-line bg-velo-panel-muted px-3 py-2.5"
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusStyles(int.status)}`}
                      >
                        {statusVerb(int.status, int.optional)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-velo-text">{int.label}</span>
                          {int.optional ? (
                            <span className="text-[10px] text-velo-muted/80">optional</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-velo-muted">{int.message}</p>
                        {int.detail ? (
                          <p className="mt-1 text-[11px] text-velo-muted/75">{int.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="border-t border-velo-line pt-3 text-[11px] text-velo-muted/85">
                {data.llm_generated ? (
                  <>Summary produced by your configured LLM · health snapshot {data.health_generated_at}</>
                ) : (
                  <>
                    Playbook fallback (LLM unavailable or misconfigured) · health snapshot{' '}
                    {data.health_generated_at}
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-velo-line px-5 py-3">
          <button
            type="button"
            onClick={() => {
              if (row) saveOperationsChatHandoff({ domain, row });
              onClose();
              router.push('/chat');
            }}
            className="block w-full rounded-lg bg-velo-accent py-2.5 text-center text-sm font-medium text-white shadow-soft ring-1 ring-velo-accent/25 hover:bg-velo-accent-hover"
          >
            Open chat with this row (mission plan)
          </button>
        </footer>
      </div>
    </div>
  );
}
