interface ExceptionCardProps {
  title: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export function ExceptionCard({ title, reason, severity }: ExceptionCardProps) {
  const severityTone =
    severity === 'high'
      ? 'border-rose-500/40'
      : severity === 'medium'
        ? 'border-amber-500/40'
        : 'border-cyan-500/40';

  return (
    <article
      className={`rounded-xl border bg-velo-panel p-4 ${severityTone}`}
    >
      <h3 className="text-base font-semibold text-velo-text">{title}</h3>
      <p className="mt-2 text-sm text-velo-muted">{reason}</p>
      <button
        type="button"
        className="mt-4 rounded-md border border-velo-line bg-velo-inset px-3 py-1.5 text-sm font-medium text-velo-text shadow-sm hover:bg-velo-inset-deep"
      >
        View evidence
      </button>
    </article>
  );
}
