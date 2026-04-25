'use client';

import type { OperationsMissionPlanResponse } from '@/lib/operations-mission-plan';
import {
  IconInfo,
  IconSparkle,
  IconTable,
  IconTarget,
  IconUsers,
} from '@/components/velo-icons';

type Props = {
  plan: OperationsMissionPlanResponse | null;
  loading: boolean;
  error: string | null;
  approving: boolean;
  onApprove: () => void;
  onDismiss: () => void;
};

/** Prefer human-readable text when a line is `toolId: description`. */
function PlanBulletLine({ line }: { line: string }) {
  const idx = line.indexOf(':');
  if (idx > 0 && idx < 48) {
    const left = line.slice(0, idx).trim();
    const right = line.slice(idx + 1).trim();
    if (/^[a-zA-Z0-9_.-]+$/.test(left) && right.length > 0) {
      return (
        <>
          <span className="text-velo-text/95">{right}</span>
        </>
      );
    }
  }
  return <span className="text-velo-text/95">{line}</span>;
}

export function OperationsMissionBriefing({
  plan,
  loading,
  error,
  approving,
  onApprove,
  onDismiss,
}: Props) {
  if (!loading && !error && !plan) return null;

  return (
    <div className="mx-auto mb-6 max-w-3xl overflow-hidden rounded-2xl border border-velo-line bg-velo-panel shadow-card">
      <div className="border-b border-velo-line bg-velo-panel-muted/50 px-5 py-4">
        <div
          className="mb-4 flex gap-3 rounded-xl border border-teal-200/90 bg-teal-50/90 px-3.5 py-3 text-xs leading-relaxed text-velo-text"
          role="note"
        >
          <IconInfo size={18} className="mt-0.5 shrink-0 text-velo-accent" aria-hidden />
          <div>
            <p className="font-semibold text-teal-900">This is a preview, not a live run</p>
            <p className="mt-1 text-velo-muted">
              You are seeing a <strong className="font-medium text-velo-text/95">draft playbook</strong> for
              this row. Nothing connects to systems and no agents execute until you choose{' '}
              <strong className="font-medium text-velo-text/95">Approve &amp; run</strong>. Text below is
              meant to read like a short briefing — not a raw stream of internal logic.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-velo-accent/90">
              <IconUsers size={14} className="text-velo-accent/80" aria-hidden />
              Mission from Operations
            </p>
            {plan ? (
              <h2 className="mt-1 flex items-start gap-2 text-lg font-semibold tracking-tight text-velo-text">
                <IconTarget size={20} className="mt-0.5 shrink-0 text-velo-accent/85" aria-hidden />
                <span>{plan.mission_title}</span>
              </h2>
            ) : (
              <h2 className="mt-1 text-lg font-semibold text-velo-muted">Preparing mission…</h2>
            )}
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-velo-muted">
              This is a draft runbook for this specific row — what to verify first, what decisions to make,
              and what would be executed after approval. You can refine it in chat before running.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={approving}
            className="rounded-lg border border-velo-line px-3 py-1.5 text-xs font-medium text-velo-muted hover:bg-velo-inset hover:text-velo-text disabled:opacity-40"
          >
            Dismiss
          </button>
        </div>
        {plan?.llm_generated ? (
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-800">
            <IconSparkle size={12} className="shrink-0" aria-hidden />
            Plan wording assisted by your LLM (still a static preview until you approve).
          </p>
        ) : plan ? (
          <p className="mt-3 text-[10px] text-velo-muted/85">
            Plan assembled from agent toolkits (LLM unavailable). Same preview rules apply — no execution
            yet.
          </p>
        ) : null}
      </div>

      <div className="max-h-[min(56vh,520px)] overflow-y-auto px-5 py-4">
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-4/5 rounded bg-velo-inset-deep" />
            <div className="h-3 w-full rounded bg-velo-inset-deep" />
            <div className="h-24 rounded-lg bg-velo-inset" />
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        )}
        {plan && !loading && (
          <div className="space-y-5">
            <section>
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                <IconTarget size={14} className="text-velo-accent/75" aria-hidden />
                In plain terms
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-velo-text/95">{plan.mission_summary}</p>
            </section>

            <section className="rounded-xl border border-velo-line bg-velo-inset px-4 py-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                Strategy
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-velo-text/90">{plan.orchestration_note}</p>
            </section>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
                <IconUsers size={14} className="text-velo-accent/75" aria-hidden />
                Who does what
              </h3>
              {plan.agent_plans.map((a) => (
                <article
                  key={a.agent_id}
                  className="rounded-xl border border-velo-line bg-velo-panel-muted px-4 py-4"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-velo-line pb-2">
                    <span className="text-base font-semibold text-velo-text">{a.label}</span>
                    <code className="rounded bg-velo-inset-deep px-2 py-0.5 text-[10px] text-velo-muted">
                      {a.agent_id}
                    </code>
                  </header>
                  <p className="mt-2 text-sm text-velo-muted/95">{a.mandate}</p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                        What to check
                      </h4>
                      <ul className="mt-2 space-y-1.5 text-xs leading-snug">
                        {a.analyze.slice(0, 10).map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-mono text-[10px] text-velo-muted/70">{i + 1}</span>
                            <span>
                              <PlanBulletLine line={line} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                        What to change or send
                      </h4>
                      <ul className="mt-2 space-y-1.5 text-xs leading-snug">
                        {a.transform.slice(0, 10).map((line, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-mono text-[10px] text-velo-muted/70">{i + 1}</span>
                            <span>
                              <PlanBulletLine line={line} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-violet-900">
                      Where results should land
                    </h4>
                    <ul className="mt-2 list-inside list-disc text-xs text-velo-muted">
                      {a.deliver_to.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  {a.tool_chain.length > 0 && (
                    <details className="group mt-4 rounded-lg border border-velo-line bg-velo-inset open:border-velo-accent/35 open:ring-1 open:ring-velo-accent/15">
                      <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-medium text-velo-muted marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="inline-flex items-center gap-2">
                          <IconTable size={14} className="text-velo-accent/75" aria-hidden />
                          Technical steps (implementation)
                          <span className="rounded bg-velo-inset-deep px-1.5 py-px text-[10px] text-velo-muted">
                            {a.tool_chain.length}
                          </span>
                        </span>
                      </summary>
                      <ol className="space-y-2 border-t border-velo-line bg-velo-panel px-3 py-3 pl-4">
                        {a.tool_chain.map((step, i) => (
                          <li key={`${step.tool_id}-${i}`} className="text-xs">
                            <div className="font-mono text-[10px] text-velo-accent/95">{step.tool_id}</div>
                            <p className="mt-0.5 text-velo-muted">{step.purpose}</p>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {plan && !loading && !error && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-velo-line bg-velo-panel-muted px-5 py-3">
          <button
            type="button"
            onClick={onApprove}
            disabled={approving}
            className="rounded-lg bg-velo-accent px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-velo-accent-hover disabled:opacity-50"
          >
            {approving ? 'Starting…' : 'Approve & run with orchestrator'}
          </button>
        </div>
      )}
    </div>
  );
}
