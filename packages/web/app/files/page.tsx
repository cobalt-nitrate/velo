'use client';

import { useEffect, useState } from 'react';

type LocalFile = {
  source: 'local';
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  createdAt: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
};

export default function FilesPage() {
  const [local, setLocal] = useState<LocalFile[]>([]);
  const [drive, setDrive] = useState<DriveFile[]>([]);
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'local' | 'drive'>('local');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/files?drive=1');
      const data = (await res.json()) as {
        local?: LocalFile[];
        drive?: { ok: true; files: DriveFile[] } | { ok: false; error: string };
      };
      setLocal(data.local ?? []);
      if (data.drive && data.drive.ok) {
        setDrive(data.drive.files);
        setDriveErr(null);
      } else if (data.drive && !data.drive.ok) {
        setDrive([]);
        setDriveErr(data.drive.error);
      }
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Files</h1>
      <p className="mt-1 text-sm text-velo-muted">
        Velo uploads (local workspace) and Google Drive folder when configured.
      </p>

      <div className="mt-4 flex gap-2 border-b border-velo-line pb-2">
        <button
          type="button"
          onClick={() => setTab('local')}
          className={`rounded-md px-3 py-1.5 text-sm ${
            tab === 'local'
              ? 'bg-velo-accent/20 text-velo-text'
              : 'text-velo-muted hover:bg-white/5'
          }`}
        >
          This workspace ({local.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('drive')}
          className={`rounded-md px-3 py-1.5 text-sm ${
            tab === 'drive'
              ? 'bg-velo-accent/20 text-velo-text'
              : 'text-velo-muted hover:bg-white/5'
          }`}
        >
          Google Drive
        </button>
      </div>

      {tab === 'local' && (
        <ul className="mt-4 grid gap-2">
          {local.length === 0 ? (
            <li className="text-sm text-velo-muted">No uploads yet — use Uploads or attach in Chat.</li>
          ) : (
            local.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm"
              >
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-velo-muted">
                  {(f.size / 1024).toFixed(1)} KB · {f.mime}
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-velo-accent hover:underline"
                >
                  Open
                </a>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === 'drive' && (
        <div className="mt-4">
          {driveErr && (
            <p className="text-sm text-amber-200/90">{driveErr}</p>
          )}
          <ul className="mt-2 grid gap-2">
            {drive.length === 0 && !driveErr ? (
              <li className="text-sm text-velo-muted">No files listed.</li>
            ) : (
              drive.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-velo-line bg-velo-panel px-3 py-2 text-sm"
                >
                  <span className="font-medium">{f.name}</span>
                  <span className="text-xs capitalize text-velo-muted">
                    {f.mimeType === 'application/vnd.google-apps.folder' ? '📁 folder' : f.mimeType}
                  </span>
                  {f.webViewLink ? (
                    <a
                      href={f.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-velo-accent hover:underline"
                    >
                      Open in Drive
                    </a>
                  ) : (
                    <span className="text-xs text-velo-muted">{f.id.slice(0, 8)}…</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </main>
  );
}
