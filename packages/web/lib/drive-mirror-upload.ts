// Optional: copy web/chat uploads to Google Drive under the same subfolder layout as tools (drive-folders.ts).

import { google } from 'googleapis';
import {
  ensureVeloDrivePath,
  segmentsForUploadedFile,
  uploadBufferToDrive,
  type UploadedFileKind,
} from '@velo/tools/documents/drive-folders';
import { recordVeloFileLink } from '@velo/tools/sheets';

function mirrorEnabled(): boolean {
  const v = process.env.VELO_DRIVE_MIRROR_UPLOADS;
  return v === '1' || v === 'true';
}

export async function mirrorUploadToDriveIfEnabled(
  filename: string,
  mime: string,
  buf: Buffer,
  options?: {
    kind?: UploadedFileKind;
    /** Sheets cohesion: e.g. ap_invoice, hr_task, approval_request (use approval_request + approval_id as scope_record_id) */
    scope_table?: string;
    scope_record_id?: string;
    role?: string;
    local_upload_id?: string;
    meta_json?: string;
  }
): Promise<
  | { ok: true; file_id: string; web_view_link: string; web_content_link?: string }
  | { ok: false; skipped?: true; error?: string }
> {
  if (!mirrorEnabled()) {
    return { ok: false, skipped: true };
  }

  const rootId = process.env.VELO_DRIVE_FOLDER_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!rootId || !email || !privateKey) {
    return {
      ok: false,
      error: 'VELO_DRIVE_FOLDER_ID or Google credentials missing for mirror',
    };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const authClient = await auth.getClient();
    const drive = google.drive({
      version: 'v3',
      auth: authClient as Parameters<typeof google.drive>[0]['auth'],
    });
    const leaf = await ensureVeloDrivePath(
      drive,
      rootId,
      segmentsForUploadedFile(filename, mime || 'application/octet-stream', options)
    );
    const created = await uploadBufferToDrive(drive, leaf, filename, mime || 'application/octet-stream', buf);

    if (options?.scope_table && options?.scope_record_id) {
      await recordVeloFileLink({
        scope_table: options.scope_table,
        scope_record_id: options.scope_record_id,
        role: options.role ?? 'mirrored_upload',
        drive_file_id: created.file_id,
        drive_web_view_url: created.web_view_link,
        mime: mime || 'application/octet-stream',
        filename,
        local_upload_id: options.local_upload_id ?? '',
        source: 'web_upload_mirror',
        meta_json: options.meta_json ?? '',
      });
    }

    return { ok: true, ...created };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
