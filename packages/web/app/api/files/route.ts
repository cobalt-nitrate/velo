import { listDriveFolder } from '@/lib/drive-list';
import { listUploads } from '@/lib/upload-store';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const local = (await listUploads()).map((u) => ({
    source: 'local' as const,
    id: u.id,
    name: u.name,
    mime: u.mime,
    size: u.size,
    url: `/api/uploads/${u.id}`,
    createdAt: u.createdAt,
  }));

  const { searchParams } = new URL(req.url);
  const includeDrive = searchParams.get('drive') !== '0';
  let drive: Awaited<ReturnType<typeof listDriveFolder>> = { ok: false, error: 'skipped' };

  if (includeDrive) {
    const folderId = process.env.VELO_DRIVE_FOLDER_ID;
    if (folderId) {
      drive = await listDriveFolder(folderId);
    } else {
      drive = { ok: false, error: 'VELO_DRIVE_FOLDER_ID not set' };
    }
  }

  return NextResponse.json({
    ok: true,
    local,
    drive: drive.ok ? { ok: true, files: drive.files } : drive,
  });
}
