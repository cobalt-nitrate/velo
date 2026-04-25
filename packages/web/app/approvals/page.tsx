import { Suspense } from 'react';
import { ApprovalsInbox } from '../../components/approvals-inbox';

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-velo-muted">Loading approvals…</p>}>
      <ApprovalsInbox />
    </Suspense>
  );
}

