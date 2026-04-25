'use client';

import { DocumentPreview } from '@/components/document-preview';
import { EmptyState } from '@/components/empty-state';
import { useEffect, useState } from 'react';

type Payload = {
  ok: boolean;
  error?: string;
  document?: { type: string; title: string; employee_email: string };
  preview_url?: string;
};

export default function EmployeeDocPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/employee/docs/${encodeURIComponent(token)}`);
        const json = (await res.json()) as Payload;
        if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <p className="p-6 text-sm text-velo-muted">Loading document…</p>;
  }

  if (error || !data?.ok) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <EmptyState
          heading="Link not available"
          body={error ?? data?.error ?? 'This link is invalid, expired, or revoked.'}
        />
      </main>
    );
  }

  const title = data.document?.title || 'Document';
  const url = data.preview_url || '';

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-velo-muted">
          {data.document?.type ?? 'document'}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-velo-text">{title}</h1>
        <p className="mt-1 text-sm text-velo-muted">
          This link is time-limited. If you can’t access the document, request a new link from HR/Finance.
        </p>
      </div>

      <DocumentPreview url={url} title={title} />
    </main>
  );
}

