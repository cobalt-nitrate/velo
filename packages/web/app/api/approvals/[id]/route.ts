// PATCH /api/approvals/[id]
// Resolves an approval request — approves or rejects it.
// Updates the approval_requests sheet and returns the updated record.

import { NextRequest, NextResponse } from 'next/server';
import {
  findApprovalById,
  isApprovalPendingStatus,
  mergeApprovalAttachmentsFromFileLinks,
  parseAttachmentDriveUrlsJson,
  updateApprovalRow,
} from '@velo/tools/data';
import { appendDecisionMemory } from '@velo/core';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const approvalId = params.id;
    if (!approvalId) {
      return NextResponse.json({ error: 'approval_id is required' }, { status: 400 });
    }

    const body = (await req.json()) as {
      resolution: 'APPROVED' | 'REJECTED';
      resolved_by?: string;
      resolution_notes?: string;
    };

    if (!body.resolution || !['APPROVED', 'REJECTED'].includes(body.resolution)) {
      return NextResponse.json(
        { error: 'resolution must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    // Derive resolved_by from session if not provided
    let resolvedBy = body.resolved_by ?? 'unknown';
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.email) resolvedBy = session.user.email;
    } catch {
      // Session unavailable in some contexts — use provided value
    }

    // Find the approval record
    const found = await findApprovalById(approvalId);
    if (!found) {
      return NextResponse.json({ error: `Approval not found: ${approvalId}` }, { status: 404 });
    }

    // Guard: don't re-resolve an already resolved approval (normalize sheet casing)
    if (!isApprovalPendingStatus(found.row.status)) {
      return NextResponse.json(
        {
          error: `Approval already resolved: status=${found.row.status}`,
          current_status: found.row.status,
        },
        { status: 409 }
      );
    }

    // Merge Drive attachments from file_links into attachment_drive_urls_json on resolve
    const mergedAttachmentsJson = await mergeApprovalAttachmentsFromFileLinks(
      approvalId,
      found.row.attachment_drive_urls_json ?? ''
    );

    // Apply the resolution
    const updates: Record<string, unknown> = {
      status: body.resolution,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_notes: body.resolution_notes ?? '',
      attachment_drive_urls_json: mergedAttachmentsJson,
    };

    await updateApprovalRow(found.spreadsheetId, found.rowIndex, found.headers, updates);

    const toolId = String(found.row.action_type ?? '').trim();
    let actionPayload: Record<string, unknown> = {};
    try {
      actionPayload = JSON.parse(
        String(found.row.action_payload_json ?? '{}')
      ) as Record<string, unknown>;
    } catch {
      actionPayload = {};
    }
    if (toolId) {
      appendDecisionMemory({
        tool_id: toolId,
        parameters: actionPayload,
        outcome: body.resolution === 'APPROVED' ? 'approved' : 'rejected',
        actor_id: resolvedBy,
        notes: body.resolution_notes,
      });
    }

    return NextResponse.json({
      ok: true,
      approval_id: approvalId,
      resolution: body.resolution,
      resolved_by: resolvedBy,
      resolved_at: updates.resolved_at,
      previous_status: found.row.status,
      attachments_merged: parseAttachmentDriveUrlsJson(mergedAttachmentsJson),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/approvals/[id] — fetch a single approval record
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const found = await findApprovalById(params.id);
    if (!found) {
      return NextResponse.json({ error: `Approval not found: ${params.id}` }, { status: 404 });
    }
    const mergedJson = await mergeApprovalAttachmentsFromFileLinks(
      params.id,
      found.row.attachment_drive_urls_json ?? ''
    );
    return NextResponse.json({
      ok: true,
      approval: found.row,
      attachments_merged: parseAttachmentDriveUrlsJson(mergedJson),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
