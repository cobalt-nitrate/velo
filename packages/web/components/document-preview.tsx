'use client';

import { useMemo } from 'react';

export function DocumentPreview({
  url,
  title,
}: {
  url: string;
  title?: string;
}) {
  const safeUrl = useMemo(() => {
    // Allow data: (inline fallback) and http(s) / relative URLs.
    return url || '';
  }, [url]);

  if (!safeUrl) {
    return (
      <div className="rounded-xl border border-velo-line bg-velo-panel p-4 text-sm text-velo-muted">
        No preview available.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-velo-line bg-velo-panel">
      <div className="flex items-center justify-between gap-2 border-b border-velo-line bg-velo-inset px-3 py-2">
        <p className="truncate text-xs font-semibold text-velo-text">{title ?? 'Preview'}</p>
        <a
          href={safeUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-velo-line bg-velo-panel px-2 py-1 text-[11px] font-semibold text-velo-text hover:bg-velo-inset"
        >
          Open
        </a>
      </div>
      <iframe
        title={title ?? 'Document preview'}
        src={safeUrl}
        className="h-[70vh] w-full bg-white"
      />
    </div>
  );
}

