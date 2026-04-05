interface ConfidenceBadgeProps {
  value: number;
}

export function ConfidenceBadge({ value }: ConfidenceBadgeProps) {
  const percentage = Math.round(value * 100);
  const tone =
    value >= 0.85
      ? 'bg-emerald-500/20 text-emerald-300'
      : value >= 0.6
        ? 'bg-amber-500/20 text-amber-300'
        : 'bg-rose-500/20 text-rose-300';

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      Confidence {percentage}%
    </span>
  );
}
