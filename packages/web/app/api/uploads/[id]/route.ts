import { absUploadPath, getUpload } from '@/lib/upload-store';
import { existsSync, readFileSync } from 'fs';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const rec = await getUpload(params.id);
  if (!rec) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const path = absUploadPath(rec);
  if (!existsSync(path)) {
    return NextResponse.json({ error: 'File missing' }, { status: 404 });
  }

  const buf = readFileSync(path);
  const headers = new Headers();
  headers.set('Content-Type', rec.mime || 'application/octet-stream');
  headers.set(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(rec.name)}"`
  );

  return new NextResponse(buf, { headers });
}
