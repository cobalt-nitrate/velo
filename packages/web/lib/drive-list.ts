import { google } from 'googleapis';

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

async function getDrive() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client as Parameters<typeof google.drive>[0]['auth'] });
}

export async function listDriveFolder(
  folderId: string
): Promise<{ ok: true; files: DriveEntry[] } | { ok: false; error: string }> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return { ok: false, error: 'Google Drive credentials not configured' };
  }
  try {
    const drive = await getDrive();
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields:
        'files(id, name, mimeType, webViewLink, modifiedTime, size)',
      pageSize: 100,
      orderBy: 'folder,name',
    });
    const files = (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      webViewLink: f.webViewLink ?? undefined,
      modifiedTime: f.modifiedTime ?? undefined,
      size: f.size ?? undefined,
    }));
    return { ok: true, files };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
