import { createHash, randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { uploadsDir } from './velo-data-dir';
import { prisma } from './prisma';

export interface UploadRecord {
  id: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  createdAt: string;
}

function toRecord(row: {
  id: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  createdAt: Date;
}): UploadRecord {
  return { ...row, createdAt: row.createdAt.toISOString() };
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

  // Size from hint or actual file stat
  const { statSync } = await import('fs');
  const size = sizeHint ?? statSync(abs).size;

  const row = await prisma.upload.create({
    data: { id, name, mime: mime || 'application/octet-stream', size, path: rel },
  });
  return toRecord(row);
}

export async function getUpload(id: string): Promise<UploadRecord | null> {
  const row = await prisma.upload.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function listUploads(): Promise<UploadRecord[]> {
  const rows = await prisma.upload.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toRecord);
}

export function absUploadPath(rec: UploadRecord): string {
  return join(uploadsDir(), rec.path);
}

export function fileChecksum(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}
