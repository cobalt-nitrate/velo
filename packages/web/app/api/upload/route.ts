import { saveUploadedFile } from '@/lib/upload-store';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data' },
        { status: 400 }
      );
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buf);
    const rec = await saveUploadedFile(file.name, file.type || 'application/octet-stream', stream, buf.length);

    return NextResponse.json({
      ok: true,
      upload: {
        id: rec.id,
        name: rec.name,
        mime: rec.mime,
        size: rec.size,
        url: `/api/uploads/${rec.id}`,
        createdAt: rec.createdAt,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
