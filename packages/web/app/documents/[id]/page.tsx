'use client';

import { DocumentPreview } from '@/components/document-preview';
import { EmptyState } from '@/components/empty-state';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type DocDetail = {
  document: {
    document_id: string;
    type: string;
    title: string;
    employee_email: string;
    created_at: string;
    created_by: string;
    source: string;
    latest_version_id: string;
  };
  versions: Array<{
    version_id: string;
    format: string;
    mime: string;
    storage: string;
    drive_web_view_url: string;
    inline_data_url: string;
    created_at: string;
  }>;
};

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<DocDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const documentId = params.id;

  const latest = useMemo(() => {
    const v = data?.versions?.[0];
    if (!v) return null;
    const url = v.drive_web_view_url || v.inline_data_url || '';
    return { ...v, url };
  }, [data]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
      const json = (await res.json()) as any;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json as DocDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function createToken() {
    setBusy(true);
    setTokenUrl(null);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry_hours: 168, scope: 'preview' }),
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setTokenUrl(String(json.url ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/regenerate`, {
        method: 'POST',
      });
      const json = (await res.json()) as any;
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-velo-muted">Loading document…</p>;
  }

  if (error && !data) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <EmptyState heading="Could not load document" body={error} actions={[{ label: 'Back', href: '/documents' }]} />
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-velo-muted">{data.document.type}</p>
          <h1 className="mt-1 text-2xl font-semibold text-velo-text">{data.document.title || data.document.document_id}</h1>
          <p className="mt-1 text-sm text-velo-muted">
            {data.document.employee_email ? `${data.document.employee_email} · ` : ''}
            created {new Date(data.document.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/documents"
            className="rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm font-medium text-velo-text hover:bg-velo-inset"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={() => void createToken()}
            disabled={busy}
            className="rounded-lg bg-velo-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Generating…' : 'Create magic link'}
          </button>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={busy}
            className="rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm font-semibold text-velo-text hover:bg-velo-inset disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {tokenUrl && (
        <div className="mt-4 rounded-xl border border-velo-line bg-velo-panel p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-velo-muted">Employee link</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <a className="text-velo-accent hover:underline" href={tokenUrl} target="_blank" rel="noreferrer">
              {tokenUrl}
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(tokenUrl)}
              className="rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-[11px] font-semibold text-velo-text"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <DocumentPreview url={latest?.url ?? ''} title={data.document.title} />
        </div>
        <aside className="rounded-xl border border-velo-line bg-velo-panel p-4">
          <p className="text-sm font-semibold text-velo-text">Versions</p>
          <ol className="mt-3 space-y-2 text-xs text-velo-muted">
            {data.versions.map((v) => (
              <li key={v.version_id} className="rounded-lg border border-velo-line bg-velo-inset p-2">
                <p className="font-mono text-[11px] text-velo-text">{v.version_id}</p>
                <p className="mt-1">{v.format} · {v.storage}</p>
                <p className="mt-1">{new Date(v.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}

