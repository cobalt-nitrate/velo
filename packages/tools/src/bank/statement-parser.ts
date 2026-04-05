export async function parseBankStatement(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const transactions = Array.isArray(params.transactions)
    ? params.transactions
    : [];
  return {
    ok: true,
    transaction_count: transactions.length,
    parsed_at: new Date().toISOString(),
  };
}
