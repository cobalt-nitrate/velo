'use client';

import { EmptyState } from '@/components/empty-state';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type DocRow = {
  document_id: string;
  type: string;
  title: string;
  subject_type: string;
  subject_id: string;
  employee_email: string;
  period_month: string;
  period_year: string;
  latest_version_id: string;
  created_at: string;
  created_by: string;
  source: string;
};

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/documents', window.location.origin);
      url.searchParams.set('limit', '100');
      if (type.trim()) url.searchParams.set('type', type.trim());
      if (employeeEmail.trim()) url.searchParams.set('employee_email', employeeEmail.trim());
      if (q.trim()) url.searchParams.set('q', q.trim());
      const res = await fetch(url.toString());
      const data = (await res.json()) as { ok: boolean; error?: string; documents?: DocRow[] };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows(data.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeOptions = useMemo(
    () => [
      '',
      'salary_slip',
      'offer_letter',
      'experience_certificate',
      'relieving_letter',
      'ar_invoice',
      'ap_invoice_source',
      'other',
    ],
    []
  );

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-velo-text">Documents</h1>
          <p className="mt-1 text-sm text-velo-muted">
            Registry of generated documents (with preview, magic links, and regeneration).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm font-medium text-velo-text hover:bg-velo-inset"
        >
          Refresh
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-velo-line bg-velo-panel p-3">
        <label className="text-xs font-medium text-velo-muted">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="ml-2 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text"
          >
            {typeOptions.map((t) => (
              <option key={t || 'all'} value={t}>
                {t || 'all'}
              </option>
            ))}
          </select>
        </label>
        <input
          value={employeeEmail}
          onChange={(e) => setEmployeeEmail(e.target.value)}
          placeholder="Employee email…"
          className="w-56 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text placeholder-velo-muted/60"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title / subject / id…"
          className="w-64 rounded-md border border-velo-line bg-velo-inset px-2 py-1 text-xs text-velo-text placeholder-velo-muted/60"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-velo-accent px-3 py-2 text-xs font-semibold text-white"
        >
          Apply
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-velo-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            heading="No documents found"
            body="Generate salary slips, offer letters, invoices, or certificates — they’ll appear here."
            actions={[{ label: 'Open chat', href: '/chat', primary: true }]}
          />
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-velo-line">
          <table className="min-w-full divide-y divide-velo-line text-left text-sm">
            <thead className="bg-velo-inset-deep text-[11px] font-semibold uppercase tracking-wider text-velo-muted">
              <tr>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Subject</th>
                <th className="px-3 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-velo-line/80 text-velo-text">
              {rows.map((r) => (
                <tr key={r.document_id} className="hover:bg-velo-inset/70">
                  <td className="px-3 py-2 font-medium">{r.title || r.document_id}</td>
                  <td className="px-3 py-2 font-mono text-xs text-velo-muted">{r.type}</td>
                  <td className="px-3 py-2 text-xs text-velo-muted">
                    <span className="font-mono">{r.subject_type}</span>
                    <span className="mx-1">·</span>
                    <span className="font-mono">{r.subject_id}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-velo-muted">{r.employee_email || '—'}</td>
                  <td className="px-3 py-2 text-xs text-velo-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/documents/${encodeURIComponent(r.document_id)}`}
                      className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-[11px] font-semibold text-velo-text hover:bg-velo-inset"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

