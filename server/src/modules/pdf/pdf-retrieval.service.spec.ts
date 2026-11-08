import { describe, expect, it, vi } from 'vitest';
import { PdfRetrievalService } from './pdf-retrieval.service.js';

describe('PdfRetrievalService', () => {
  it('keeps semantically relevant source chunks under the default similarity floor', async () => {
    const queryRows = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'chunk_1',
          sourceId: 'source_1',
          pageStart: 2,
          pageEnd: 2,
          text: 'strong',
          similarity: 0.316,
        },
        {
          id: 'chunk_below_floor',
          sourceId: 'source_1',
          pageStart: 3,
          pageEnd: 3,
          text: 'unrelated',
          similarity: 0.14,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'chunk_2',
          sourceId: 'source_2',
          pageStart: 4,
          pageEnd: 4,
          text: 'relevant',
          similarity: 0.163,
        },
      ]);
    const postgres = {
      withWorkerPdfContext: vi.fn(
        async (_owner: string, _source: string, _revision: number, operation) =>
          operation({ $queryRaw: queryRows })
      ),
    };
    const embeddings = { embed: vi.fn().mockResolvedValue([Array(1024).fill(0.5)]) };
    const config = { get: vi.fn((_key: string, fallback?: unknown) => fallback) };
    const service = new PdfRetrievalService(
      postgres as never,
      embeddings as never,
      config as never
    );

    await expect(
      service.retrieve(
        'user_1',
        [
          { sourceId: 'source_1', revision: 2 },
          { sourceId: 'source_2', revision: 1 },
        ],
        'make practice questions'
      )
    ).resolves.toEqual([
      {
        id: 'chunk_1',
        sourceId: 'source_1',
        pageStart: 2,
        pageEnd: 2,
        text: 'strong',
        similarity: 0.316,
      },
      {
        id: 'chunk_2',
        sourceId: 'source_2',
        pageStart: 4,
        pageEnd: 4,
        text: 'relevant',
        similarity: 0.163,
      },
    ]);
    expect(embeddings.embed).toHaveBeenCalledWith(['make practice questions'], 'query');
    expect(postgres.withWorkerPdfContext).toHaveBeenCalledTimes(2);
    expect(postgres.withWorkerPdfContext).toHaveBeenNthCalledWith(
      1,
      'user_1',
      'source_1',
      2,
      expect.any(Function)
    );
    expect(postgres.withWorkerPdfContext).toHaveBeenNthCalledWith(
      2,
      'user_1',
      'source_2',
      1,
      expect.any(Function)
    );
    const sql = queryRows.mock.calls[0]?.[0] as { values?: unknown[] };
    expect(sql.values).toEqual(expect.arrayContaining(['user_1', 'source_1', 2]));
  });

  it('returns no chunks when the selected source list is empty', async () => {
    const postgres = { withWorkerPdfContext: vi.fn() };
    const embeddings = { embed: vi.fn() };
    const service = new PdfRetrievalService(postgres as never, embeddings as never, {} as never);
    await expect(service.retrieve('user_1', [], 'query')).resolves.toEqual([]);
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(postgres.withWorkerPdfContext).not.toHaveBeenCalled();
  });

  it('returns no matches when the embedding adapter has no query vector', async () => {
    const postgres = { withWorkerPdfContext: vi.fn() };
    const embeddings = { embed: vi.fn().mockResolvedValue([]) };
    const service = new PdfRetrievalService(postgres as never, embeddings as never, {} as never);
    await expect(
      service.retrieve('user_1', [{ sourceId: 'source_1', revision: 1 }], 'query')
    ).resolves.toEqual([]);
    expect(postgres.withWorkerPdfContext).not.toHaveBeenCalled();
  });
});
