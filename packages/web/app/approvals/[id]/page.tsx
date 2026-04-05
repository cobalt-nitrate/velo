import { Suspense } from 'react';
import { ApprovalReview } from '../../../components/approval-review';

export default function ApprovalPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-velo-muted">Loading…</p>}>
      <ApprovalReview approvalId={params.id} />
    </Suspense>
  );
}
