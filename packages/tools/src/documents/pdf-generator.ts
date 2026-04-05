export async function generatePdfDocument(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const documentId = `doc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  return {
    ok: true,
    document_id: documentId,
    url: `https://documents.velo.local/${documentId}`,
    kind: params.kind ?? 'invoice',
    generated_at: new Date().toISOString(),
  };
}
