interface ConfidenceBadgeProps {
  value: number;
}

export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  const percentage = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/90'
      : value >= 0.6
        ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/90'
        : 'bg-rose-50 text-rose-900 ring-1 ring-rose-200/90';

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      Confidence {percentage}%
    </span>
  );
}
