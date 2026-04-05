/** Sheet / UI may use blanks, different casing, or trailing spaces — treat as pending when not resolved. */
export function isApprovalPendingStatus(status: unknown): boolean {
  const s = String(status ?? '').trim().toUpperCase();
  return s === '' || s === 'PENDING';
}

/** Workflow resume: only continue when the row is explicitly approved. */
export function isApprovalApprovedStatus(status: unknown): boolean {
  const s = String(status ?? '').trim().toUpperCase();
  return s === 'APPROVED';
}
