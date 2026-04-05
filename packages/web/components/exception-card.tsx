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
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-velo-muted">{reason}</p>
      <button className="mt-4 rounded-md bg-white/10 px-3 py-1.5 text-sm">
        View evidence
      </button>
    </article>
  );
}
