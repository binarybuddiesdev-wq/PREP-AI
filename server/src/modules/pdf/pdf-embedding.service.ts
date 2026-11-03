export const PDF_EMBEDDING_MODEL = 'nvidia/nemotron-3.5-embed-1b';
export const PDF_EMBEDDING_DIMENSIONS = 1024;
const MAX_BATCH_SIZE = 32;
const REQUEST_TIMEOUT_MS = 30_000;

export type PdfEmbeddingInputType = 'passage' | 'query';

export class PdfEmbeddingService {
  async embed(texts: string[], inputType: PdfEmbeddingInputType): Promise<number[][]> {
    if (!texts.length) return [];
    if (!['passage', 'query'].includes(inputType)) {
      throw new Error('Invalid PDF embedding input type');
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error('PDF embedding is not configured');

    const baseUrl = (
      process.env.NVIDIA_EMBEDDING_BASE_URL?.trim() ||
      process.env.NVIDIA_BASE_URL?.trim() ||
      'https://integrate.api.nvidia.com/v1'
    ).replace(/\/+$/u, '');
    const result: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + MAX_BATCH_SIZE);
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: batch,
          input_type: inputType,
          model: PDF_EMBEDDING_MODEL,
          dimensions: PDF_EMBEDDING_DIMENSIONS,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }).catch(() => {
        throw new Error('PDF embedding provider is unavailable');
      });

      if (!response.ok) throw new Error('PDF embedding provider rejected the request');
      const payload = (await response.json().catch(() => null)) as {
        data?: Array<{ index?: number; embedding?: unknown }>;
      } | null;
      const embeddings = payload?.data;
      if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
        throw new Error('Embedding provider returned an invalid response');
      }

      const ordered = [...embeddings].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
      for (const item of ordered) {
        if (
          !Array.isArray(item.embedding) ||
          item.embedding.length !== PDF_EMBEDDING_DIMENSIONS ||
          !item.embedding.every((value) => typeof value === 'number' && Number.isFinite(value))
        ) {
          throw new Error('Embedding provider returned an invalid vector');
        }
        result.push(item.embedding as number[]);
      }
    }

    return result;
  }
}
