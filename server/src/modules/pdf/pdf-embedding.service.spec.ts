import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfEmbeddingService } from './pdf-embedding.service.js';

describe('PdfEmbeddingService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the pinned NVIDIA model and correct passage/query input modes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1024).fill(0.25) }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('NVIDIA_BASE_URL', 'https://nim.example/v1');

    const service = new PdfEmbeddingService();
    await expect(service.embed(['page text'], 'passage')).resolves.toHaveLength(1);
    await expect(service.embed(['study query'], 'query')).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://nim.example/v1/embeddings',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        body: JSON.stringify({
          input: ['page text'],
          input_type: 'passage',
          model: 'nvidia/nemotron-3.5-embed-1b',
          dimensions: 1024,
        }),
      })
    );
  });

  it('rejects invalid vectors and fails closed when embedding credentials are missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1023).fill(0.1) }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');

    await expect(new PdfEmbeddingService().embed(['text'], 'query')).rejects.toThrow(
      'Embedding provider returned an invalid vector'
    );
    vi.stubEnv('NVIDIA_API_KEY', '');
    await expect(new PdfEmbeddingService().embed(['text'], 'query')).rejects.toThrow(
      'PDF embedding is not configured'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty results without provider calls and rejects malformed provider responses', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    const service = new PdfEmbeddingService();
    await expect(service.embed([], 'query')).resolves.toEqual([]);
    await expect(service.embed(['text'], 'invalid' as never)).rejects.toThrow(
      'Invalid PDF embedding input type'
    );

    fetchMock.mockResolvedValueOnce({ ok: false });
    await expect(service.embed(['text'], 'query')).rejects.toThrow(
      'PDF embedding provider rejected the request'
    );
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    await expect(service.embed(['text'], 'query')).rejects.toThrow(
      'Embedding provider returned an invalid response'
    );
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(service.embed(['text'], 'query')).rejects.toThrow(
      'PDF embedding provider is unavailable'
    );
  });

  it('rejects non-finite values and orders provider vectors by their response indices', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ embedding: [NaN, ...Array(1023).fill(0.1)] }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { index: 1, embedding: Array(1024).fill(0.2) },
              { index: 0, embedding: Array(1024).fill(0.1) },
            ],
          }),
        })
    );
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    const service = new PdfEmbeddingService();
    await expect(service.embed(['bad'], 'passage')).rejects.toThrow(
      'Embedding provider returned an invalid vector'
    );
    const vectors = await service.embed(['first', 'second'], 'passage');
    expect(vectors[0]?.[0]).toBe(0.1);
    expect(vectors[1]?.[0]).toBe(0.2);
  });

  it('batches long embedding requests into provider-sized calls', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (_url: string, options: { body: string }) => {
        const input = JSON.parse(options.body).input as string[];
        return {
          ok: true,
          json: async () => ({ data: input.map(() => ({ embedding: Array(1024).fill(0.1) })) }),
        };
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    const vectors = await new PdfEmbeddingService().embed(
      Array.from({ length: 33 }, (_, i) => `${i}`),
      'passage'
    );
    expect(vectors).toHaveLength(33);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the default NVIDIA endpoint when no endpoint override is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: Array(1024).fill(0.2) }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NVIDIA_API_KEY', 'test-key');
    vi.stubEnv('NVIDIA_BASE_URL', '');
    vi.stubEnv('NVIDIA_EMBEDDING_BASE_URL', '');
    await new PdfEmbeddingService().embed(['text'], 'query');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/embeddings',
      expect.any(Object)
    );
  });
});
