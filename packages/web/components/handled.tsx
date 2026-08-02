import type { HandledSummary } from '../lib/home/activity';

/**
 * "Velo handled N things this week" (UX-002).
 *
 * Deliberately quiet: this is reassurance, not a call to action, so it must not
 * compete with the queue above it. Uses a native <details> so the breakdown
 * expands without shipping any client JavaScript.
 */
export function Handled({ summary }: { summary: HandledSummary | null }) {
  // Nothing to report reads better as nothing at all than as a zero.
  if (!summary || summary.count === 0) return null;

  const { count, windowDays, areas } = summary;

  return (
    <details className="group rounded-xl border border-velo-line bg-velo-inset/50 px-5 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-velo-text/80 marker:hidden">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
          aria-hidden
        />
        <span>
          Velo handled{' '}
          <span className="font-semibold text-velo-text">
            {count} {count === 1 ? 'thing' : 'things'}
          </span>{' '}
          in the last {windowDays} days
        </span>
        <span className="ml-auto text-xs text-velo-muted group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-velo-muted group-open:inline">Hide</span>
      </summary>

      <ul className="mt-3 space-y-1.5 border-t border-velo-line pt-3">
        {areas.map((a) => (
          <li key={a.label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-velo-text/80">{a.label}</span>
            <span className="tabular-nums text-velo-muted">{a.count}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-velo-muted">
        None of these needed you. They are listed so you can check the work, not do it.
      </p>
    </details>
  );
}
