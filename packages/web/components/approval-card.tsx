import { ConfidenceBadge } from './confidence-badge';
import { PolicyChip } from './policy-chip';

interface ApprovalCardProps {
  title: string;
  summary: string;
  confidence: number;
}

export function ApprovalCard({ title, summary, confidence }: ApprovalCardProps) {
  return (
    <article className="rounded-xl border border-velo-line bg-velo-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <PolicyChip policy="REQUEST_APPROVAL" />
      </div>
      <p className="mt-2 text-sm text-velo-muted">{summary}</p>
      <div className="mt-4 flex items-center justify-between">
        <ConfidenceBadge value={confidence} />
        <div className="flex gap-2">
          <button className="rounded-md bg-rose-500/20 px-3 py-1.5 text-sm text-rose-200">
            Reject
          </button>
          <button className="rounded-md bg-velo-accent px-3 py-1.5 text-sm font-medium text-black">
            Approve
          </button>
        </div>
      </div>
    </article>
  );
}
