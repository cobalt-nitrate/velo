import { createHash, randomUUID } from 'crypto';
import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { uploadsDir, veloDataDir } from './velo-data-dir';

export interface UploadRecord {
  id: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  createdAt: string;
}

const META = 'uploads-meta.json';

function metaPath(): string {
  return join(veloDataDir(), META);
}

function readMeta(): Record<string, UploadRecord> {
  const p = metaPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, UploadRecord>;
  } catch {
    return {};
  }
}

function writeMeta(data: Record<string, UploadRecord>): void {
  writeFileSync(metaPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export async function saveUploadedFile(
  name: string,
  mime: string,
  stream: Readable,
  sizeHint?: number
): Promise<UploadRecord> {
  await mkdir(uploadsDir(), { recursive: true });
  const id = randomUUID();
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const rel = `${id}_${safe}`;
  const abs = join(uploadsDir(), rel);
  const ws = createWriteStream(abs);
  await pipeline(stream, ws);

  const bufStat = readFileSync(abs);
  const size = sizeHint ?? bufStat.length;

  const rec: UploadRecord = {
    id,
    name,
    mime: mime || 'application/octet-stream',
    size,
    path: rel,
    createdAt: new Date().toISOString(),
  };
  const all = readMeta();
  all[id] = rec;
  writeMeta(all);
  return rec;
}

export function getUpload(id: string): UploadRecord | null {
  return readMeta()[id] ?? null;
}

export function listUploads(): UploadRecord[] {
  return Object.values(readMeta()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function absUploadPath(rec: UploadRecord): string {
  return join(uploadsDir(), rec.path);
}

export function fileChecksum(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}
