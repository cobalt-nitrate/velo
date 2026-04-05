// Merge file_links rows into approval_requests.attachment_drive_urls_json (JSON array).

export const APPROVAL_FILE_LINK_SCOPE = 'approval_request';

export type DriveAttachmentRef = {
  drive_file_id: string;
  drive_web_view_url: string;
  role?: string;
  filename?: string;
  source?: string;
  link_id?: string;
  mime?: string;
};

export function parseAttachmentDriveUrlsJson(raw: string): DriveAttachmentRef[] {
  if (!raw?.trim()) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
      .map((x) => ({
        drive_file_id: String(x.drive_file_id ?? ''),
        drive_web_view_url: String(x.drive_web_view_url ?? x.url ?? ''),
        role: x.role != null ? String(x.role) : undefined,
        filename: x.filename != null ? String(x.filename) : undefined,
        source: x.source != null ? String(x.source) : undefined,
        link_id: x.link_id != null ? String(x.link_id) : undefined,
        mime: x.mime != null ? String(x.mime) : undefined,
      }))
      .filter((x) => x.drive_file_id.length > 0);
  } catch {
    return [];
  }
}

export function fileLinkRowToRef(row: Record<string, string>): DriveAttachmentRef | null {
  const id = row.drive_file_id?.trim();
  if (!id) return null;
  return {
    drive_file_id: id,
    drive_web_view_url: String(row.drive_web_view_url ?? ''),
    role: row.role || undefined,
    filename: row.filename || undefined,
    source: row.source || undefined,
    link_id: row.link_id || undefined,
    mime: row.mime || undefined,
  };
}

/** Dedupe by drive_file_id; cell entries win on conflict, then add new from file_links. */
export function mergeAttachmentRefs(
  fromCell: DriveAttachmentRef[],
  fromFileLinks: DriveAttachmentRef[]
): DriveAttachmentRef[] {
  const byId = new Map<string, DriveAttachmentRef>();
  for (const e of fromCell) {
    if (e.drive_file_id) byId.set(e.drive_file_id, { ...e });
  }
  for (const e of fromFileLinks) {
    if (!e.drive_file_id) continue;
    if (!byId.has(e.drive_file_id)) byId.set(e.drive_file_id, { ...e });
  }
  return [...byId.values()];
}

export function stringifyAttachmentRefs(refs: DriveAttachmentRef[]): string {
  return JSON.stringify(refs);
}

/** Produce updated JSON string for the sheet cell. */
export function mergeFileLinkRowsIntoApprovalAttachmentsJson(
  existingCell: string,
  fileLinkRows: Record<string, string>[]
): string {
  const cell = parseAttachmentDriveUrlsJson(existingCell);
  const fromLinks = fileLinkRows
    .map(fileLinkRowToRef)
    .filter((x): x is DriveAttachmentRef => x != null);
  return stringifyAttachmentRefs(mergeAttachmentRefs(cell, fromLinks));
}
