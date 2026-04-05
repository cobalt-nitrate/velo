export async function parseInvoiceText(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const text = String(params.text ?? '');
  const amountMatch = text.match(/(?:rs|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null;

  return {
    ok: true,
    extracted_fields: {
      vendor_name: params.vendor_name ?? null,
      invoice_date: params.invoice_date ?? null,
      total_amount: amount,
    },
  };
}
