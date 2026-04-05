import { saveUploadedFile } from '@/lib/upload-store';
import { mirrorUploadToDriveIfEnabled } from '@/lib/drive-mirror-upload';
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

    const kindRaw = form.get('kind');
    const scopeTable = form.get('scope_table');
    const scopeRecordId = form.get('scope_record_id');
    const scopeRole = form.get('scope_role');
    const mirrorOpts = {
      kind: kindRaw === 'screenshot' ? ('screenshot' as const) : undefined,
      scope_table: typeof scopeTable === 'string' ? scopeTable : undefined,
      scope_record_id: typeof scopeRecordId === 'string' ? scopeRecordId : undefined,
      role: typeof scopeRole === 'string' ? scopeRole : undefined,
      local_upload_id: rec.id,
    };
    const driveMirror =
      kindRaw === 'screenshot'
        ? await mirrorUploadToDriveIfEnabled(rec.name, rec.mime, buf, {
            ...mirrorOpts,
            kind: 'screenshot',
          })
        : await mirrorUploadToDriveIfEnabled(rec.name, rec.mime, buf, mirrorOpts);

    return NextResponse.json({
      ok: true,
      upload: {
        id: rec.id,
        name: rec.name,
        mime: rec.mime,
        size: rec.size,
        url: `/api/uploads/${rec.id}`,
        createdAt: rec.createdAt,
        ...(driveMirror.ok
          ? {
              drive: {
                file_id: driveMirror.file_id,
                url: driveMirror.web_view_link,
              },
            }
          : driveMirror.error && !driveMirror.skipped
            ? { drive_mirror_error: driveMirror.error }
            : {}),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
