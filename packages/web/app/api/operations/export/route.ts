import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Domain = 'ap' | 'ar_open' | 'ar_overdue' | 'bank' | 'compliance' | 'approvals';

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(csvEscape).join(',');
  const lines = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(','));
  return [head, ...lines].join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = (searchParams.get('domain') ?? '').trim() as Domain;
    if (!['ap', 'ar_open', 'ar_overdue', 'bank', 'compliance', 'approvals'].includes(domain)) {
      return NextResponse.json({ ok: false, error: 'Invalid domain' }, { status: 400 });
    }

    let headers: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (domain === 'bank') {
      const data = await prisma.bankTransaction.findMany({
        orderBy: [{ date: 'desc' }, { txnId: 'desc' }],
        take: 2000,
        select: { txnId: true, date: true, narration: true, amount: true, balance: true, type: true, mode: true },
      });
      headers = ['txn_id', 'date', 'narration', 'amount', 'balance', 'type', 'mode'];
      rows = data.map((r) => ({
        txn_id: r.txnId,
        date: r.date,
        narration: r.narration,
        amount: r.amount,
        balance: r.balance,
        type: r.type,
        mode: r.mode,
      }));
    }

    if (domain === 'compliance') {
      const data = await prisma.complianceCalendar.findMany({
        orderBy: { dueDate: 'asc' },
        take: 2000,
        select: {
          calendarId: true,
          type: true,
          label: true,
          periodMonth: true,
          periodYear: true,
          dueDate: true,
          status: true,
          completedDate: true,
          filingReference: true,
          notes: true,
        },
      });
      headers = [
        'calendar_id',
        'type',
        'label',
        'period_month',
        'period_year',
        'due_date',
        'status',
        'completed_date',
        'filing_reference',
        'notes',
      ];
      rows = data.map((r) => ({
        calendar_id: r.calendarId,
        type: r.type,
        label: r.label,
        period_month: r.periodMonth,
        period_year: r.periodYear,
        due_date: r.dueDate,
        status: r.status,
        completed_date: r.completedDate,
        filing_reference: r.filingReference,
        notes: r.notes,
      }));
    }

    if (domain === 'ap') {
      const data = await prisma.apInvoice.findMany({
        orderBy: { dueDate: 'asc' },
        take: 2000,
        select: {
          invoiceId: true,
          vendorId: true,
          vendorName: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          totalAmount: true,
          paymentStatus: true,
          paymentDate: true,
          bankReference: true,
        },
      });
      headers = [
        'invoice_id',
        'vendor_id',
        'vendor_name',
        'invoice_number',
        'invoice_date',
        'due_date',
        'total_amount',
        'payment_status',
        'payment_date',
        'bank_reference',
      ];
      rows = data.map((r) => ({
        invoice_id: r.invoiceId,
        vendor_id: r.vendorId,
        vendor_name: r.vendorName,
        invoice_number: r.invoiceNumber,
        invoice_date: r.invoiceDate,
        due_date: r.dueDate,
        total_amount: r.totalAmount,
        payment_status: r.paymentStatus,
        payment_date: r.paymentDate,
        bank_reference: r.bankReference,
      }));
    }

    if (domain === 'ar_open' || domain === 'ar_overdue') {
      const data = await prisma.arInvoice.findMany({
        orderBy: { dueDate: 'asc' },
        take: 2000,
        select: {
          invoiceId: true,
          clientId: true,
          clientName: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          totalAmount: true,
          status: true,
          followupCount: true,
          paymentReceivedDate: true,
        },
      });
      headers = [
        'invoice_id',
        'client_id',
        'client_name',
        'invoice_number',
        'invoice_date',
        'due_date',
        'total_amount',
        'status',
        'followup_count',
        'payment_received_date',
      ];
      rows = data.map((r) => ({
        invoice_id: r.invoiceId,
        client_id: r.clientId,
        client_name: r.clientName,
        invoice_number: r.invoiceNumber,
        invoice_date: r.invoiceDate,
        due_date: r.dueDate,
        total_amount: r.totalAmount,
        status: r.status,
        followup_count: r.followupCount,
        payment_received_date: r.paymentReceivedDate,
      }));
    }

    if (domain === 'approvals') {
      const data = await prisma.approvalRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2000,
        select: {
          approvalId: true,
          agentId: true,
          actionType: true,
          confidenceScore: true,
          createdAt: true,
          expiresAt: true,
          status: true,
          approverRole: true,
          resolvedBy: true,
          resolvedAt: true,
          resolutionNotes: true,
        },
      });
      headers = [
        'approval_id',
        'agent_id',
        'action_type',
        'confidence_score',
        'created_at',
        'expires_at',
        'status',
        'approver_role',
        'resolved_by',
        'resolved_at',
        'resolution_notes',
      ];
      rows = data.map((r) => ({
        approval_id: r.approvalId,
        agent_id: r.agentId,
        action_type: r.actionType,
        confidence_score: r.confidenceScore,
        created_at: r.createdAt,
        expires_at: r.expiresAt,
        status: r.status,
        approver_role: r.approverRole,
        resolved_by: r.resolvedBy,
        resolved_at: r.resolvedAt,
        resolution_notes: r.resolutionNotes,
      }));
    }

    const csv = rowsToCsv(headers, rows);
    const filename = `velo-export-${domain}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

