'use client';

import Link from 'next/link';
import type { DragEvent } from 'react';
import { useCallback, useState } from 'react';

export default function UploadsPage() {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setBusy(true);
    const lines: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = (await res.json()) as {
          ok?: boolean;
          upload?: { id: string; name: string; url: string };
          error?: string;
        };
        if (data.ok && data.upload) {
          lines.push(`✓ ${data.upload.name} → ${data.upload.url}`);
        } else {
          lines.push(`✗ ${file.name}: ${data.error ?? 'failed'}`);
        }
      }
    } finally {
      setBusy(false);
      setLog((prev) => [...lines, ...prev].slice(0, 20));
    }
  }, []);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Uploads</h1>
      <p className="mt-1 max-w-2xl text-sm text-velo-muted">
        Drop bank CSVs, invoices, or exports here. Files stay in your Velo workspace (
        <code className="rounded bg-velo-inset-deep px-1 text-velo-text">.velo/uploads</code>
        ) and show up under{' '}
        <Link href="/files" className="text-velo-accent hover:underline">
          Files
        </Link>
        . Attach the same files from{' '}
        <Link href="/chat" className="text-velo-accent hover:underline">
          Chat
        </Link>{' '}
        for agent context.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`mt-6 flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
          drag
            ? 'border-velo-accent bg-velo-accent/10'
            : 'border-velo-line bg-velo-panel'
        }`}
      >
        <p className="text-sm text-velo-muted">
          Drag files here or{' '}
          <label className="cursor-pointer text-velo-accent hover:underline">
            browse
            <input
              type="file"
              multiple
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
              }}
            />
          </label>
        </p>
        {busy && <p className="mt-2 text-xs text-velo-muted">Uploading…</p>}
      </div>

      {log.length > 0 && (
        <ul className="mt-6 space-y-1 rounded-lg border border-velo-line bg-velo-inset p-3 font-mono text-xs">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
