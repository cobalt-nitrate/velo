import { readFileSync } from 'fs';
import { absUploadPath, getUpload } from './upload-store';

const MAX_INLINE = 120_000;

/**
 * Builds an optional plaintext block from uploaded files for the LLM prompt.
 */
export function buildAttachmentContext(uploadIds: string[]): {
  block: string;
  previews: Array<{ id: string; name: string; snippet: string }>;
} {
  const previews: Array<{ id: string; name: string; snippet: string }> = [];
  const parts: string[] = [];

  for (const id of uploadIds) {
    const rec = getUpload(id);
    if (!rec) continue;
    const p = absUploadPath(rec);
    const isText =
      rec.mime.startsWith('text/') ||
      rec.mime === 'application/csv' ||
      rec.mime === 'text/csv' ||
      rec.name.toLowerCase().endsWith('.csv');

    if (isText) {
      try {
        const raw = readFileSync(p, 'utf-8').slice(0, MAX_INLINE);
        parts.push(`--- File: ${rec.name} (${rec.mime}) ---\n${raw}`);
        previews.push({
          id,
          name: rec.name,
          snippet: raw.slice(0, 2000) + (raw.length > 2000 ? '…' : ''),
        });
      } catch {
        parts.push(`--- File: ${rec.name} (could not read as UTF-8) ---`);
      }
    } else {
      parts.push(
        `--- File: ${rec.name} (${rec.mime}) — binary or non-text; use tools or download URL /api/uploads/${id} ---`
      );
      previews.push({
        id,
        name: rec.name,
        snippet: '[Binary attachment — link passed to agent context]',
      });
    }
  }

  const block =
    parts.length > 0
      ? `\n\n### Attachments\n${parts.join('\n\n')}\n### End attachments\n`
      : '';
  return { block, previews };
}
