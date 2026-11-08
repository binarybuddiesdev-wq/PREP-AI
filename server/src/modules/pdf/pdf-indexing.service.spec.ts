import { describe, expect, it, vi } from 'vitest';
import { PdfIndexingService } from './pdf-indexing.service.js';

describe('PdfIndexingService', () => {
  function setup() {
    const source = {
      id: 'source_1',
      userId: 'user_1',
      assetId: 'private-asset',
      byteSize: 100,
      pageCount: 1,
      status: 'queued',
      activeRevision: 0,
      requestedRevision: 1,
    };
    const prisma = {
      pdfSource: {
        findUnique: vi.fn().mockResolvedValue(source),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const postgres = {
      withWorkerPdfContext: vi.fn(
        async (_ownerId: string, _sourceId: string, _revision: number, operation) =>
          operation({ $executeRaw: vi.fn().mockResolvedValue(1) })
      ),
    };
    const storage = {
      download: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const extractor = {
      extract: vi
        .fn()
        .mockResolvedValue({ pageCount: 1, pages: [{ page: 1, text: 'chunk text' }] }),
    };
    const embeddings = { embed: vi.fn().mockResolvedValue([Array(1024).fill(0.25)]) };
    const config = { get: vi.fn((_key: string, fallback?: unknown) => fallback) };
    const service = new PdfIndexingService(
      prisma as never,
      postgres as never,
      storage as never,
      extractor as never,
      embeddings as never,
      config as never
    );
    return { service, prisma, postgres, storage, extractor, embeddings, source, config };
  }

  it('indexes vectors with persisted owner/source/revision and then activates the revision', async () => {
    const { service, prisma, postgres, storage, extractor, embeddings } = setup();
    await service.ingest('source_1', 1);

    expect(storage.download).toHaveBeenCalledWith('private-asset', 10 * 1024 * 1024);
    expect(extractor.extract).toHaveBeenCalledWith(expect.any(Buffer), 400, 1_000_000);
    expect(embeddings.embed).toHaveBeenCalledWith(['chunk text'], 'passage');
    expect(postgres.withWorkerPdfContext).toHaveBeenCalledWith(
      'user_1',
      'source_1',
      1,
      expect.any(Function)
    );
    expect(prisma.pdfSource.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'source_1', requestedRevision: 1 }),
        data: { status: 'ready', activeRevision: 1, failureCode: null, dispatchNeeded: false },
      })
    );
  });

  it('claims a failed source when reindexing its requested revision', async () => {
    const { service, prisma, source, storage } = setup();
    prisma.pdfSource.findUnique.mockResolvedValue({
      ...source,
      status: 'failed',
      requestedRevision: 2,
    });

    await service.ingest('source_1', 2);

    expect(prisma.pdfSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['queued', 'processing', 'ready', 'failed'] },
        }),
      })
    );
    expect(storage.download).toHaveBeenCalledOnce();
  });

  it('ignores missing, deleting, or stale revision jobs without loading a file', async () => {
    const { service, prisma, storage } = setup();
    prisma.pdfSource.findUnique.mockResolvedValueOnce(null);
    await service.ingest('missing', 1);
    prisma.pdfSource.findUnique.mockResolvedValueOnce({ id: 'source_1', status: 'deleting' });
    await service.ingest('source_1', 1);
    prisma.pdfSource.findUnique.mockResolvedValueOnce({
      id: 'source_1',
      userId: 'user_1',
      assetId: 'asset',
      status: 'ready',
      activeRevision: 1,
      requestedRevision: 2,
    });
    await service.ingest('source_1', 1);
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('does not activate an obsolete revision and removes its partial chunks', async () => {
    const { service, prisma, postgres, source } = setup();
    prisma.pdfSource.findUnique.mockResolvedValue({ ...source, requestedRevision: 1 });
    prisma.pdfSource.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await service.ingest('source_1', 1);
    expect(postgres.withWorkerPdfContext).toHaveBeenCalledTimes(2);
    expect(prisma.pdfSource.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ready', activeRevision: 1 }),
      })
    );
  });

  it('rejects empty extracted content before asking the embedding provider', async () => {
    const { service, extractor, embeddings } = setup();
    extractor.extract.mockResolvedValue({ pageCount: 1, pages: [{ page: 1, text: '   ' }] });
    await expect(service.ingest('source_1', 1)).rejects.toThrow('PDF contains no extractable text');
    expect(embeddings.embed).not.toHaveBeenCalled();
  });

  it('stops after failing to claim the source and rejects an excessive chunk count', async () => {
    const declined = setup();
    declined.prisma.pdfSource.updateMany.mockResolvedValueOnce({ count: 0 });
    await declined.service.ingest('source_1', 1);
    expect(declined.storage.download).not.toHaveBeenCalled();

    const excessive = setup();
    excessive.extractor.extract.mockResolvedValue({
      pageCount: 1001,
      pages: Array.from({ length: 1001 }, (_, index) => ({ page: index + 1, text: 'x' })),
    });
    await expect(excessive.service.ingest('source_1', 1)).rejects.toThrow(
      'PDF exceeds the chunk limit'
    );
    expect(excessive.embeddings.embed).not.toHaveBeenCalled();
  });

  it('rejects an embedding count mismatch before writing vectors', async () => {
    const { service, embeddings, postgres } = setup();
    embeddings.embed.mockResolvedValue([]);
    await expect(service.ingest('source_1', 1)).rejects.toThrow(
      'Embedding count does not match PDF chunks'
    );
    expect(postgres.withWorkerPdfContext).not.toHaveBeenCalled();
  });

  it('activates a successful new revision and deletes prior vectors', async () => {
    const { service, postgres, source, prisma } = setup();
    prisma.pdfSource.findUnique.mockResolvedValue({
      ...source,
      requestedRevision: 2,
      activeRevision: 1,
      status: 'ready',
    });
    await service.ingest('source_1', 2);
    expect(postgres.withWorkerPdfContext).toHaveBeenCalledTimes(2);
    expect(postgres.withWorkerPdfContext).toHaveBeenLastCalledWith(
      'user_1',
      source.id,
      1,
      expect.any(Function)
    );
  });

  it('keeps the prior ready revision active when a reindex attempt fails', async () => {
    const { service, prisma, source } = setup();
    prisma.pdfSource.findUnique.mockResolvedValue({
      ...source,
      activeRevision: 1,
      requestedRevision: 2,
    });
    await service.markFailed('source_1', 2);
    expect(prisma.pdfSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ready', failureCode: 'reindex_failed' },
      })
    );
  });

  it('marks a first indexing failure failed and ignores missing records', async () => {
    const { service, prisma } = setup();
    prisma.pdfSource.findUnique.mockResolvedValueOnce({ activeRevision: 0 });
    await service.markFailed('source_1', 1, 'invalid_pdf');
    expect(prisma.pdfSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'failed', failureCode: 'invalid_pdf' },
      })
    );
    prisma.pdfSource.findUnique.mockResolvedValueOnce(null);
    await service.markFailed('missing', 1);
    expect(prisma.pdfSource.updateMany).toHaveBeenCalledTimes(1);
  });

  it('deletes current and requested revisions plus the stored asset idempotently', async () => {
    const { service, prisma, postgres, storage } = setup();
    prisma.pdfSource.findUnique.mockResolvedValueOnce({
      id: 'source_1',
      userId: 'user_1',
      assetId: 'private-asset',
      status: 'deleting',
      activeRevision: 2,
      requestedRevision: 3,
    });
    await service.delete('source_1');
    expect(postgres.withWorkerPdfContext).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledWith('private-asset');
    expect(prisma.pdfSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'deleted', assetId: null, dispatchNeeded: false }),
      })
    );
    prisma.pdfSource.findUnique.mockResolvedValueOnce(null);
    await service.delete('missing');
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('does not delete already deleted sources and supports metadata without an asset', async () => {
    const deleted = setup();
    deleted.prisma.pdfSource.findUnique.mockResolvedValueOnce({
      id: 'source_1',
      status: 'deleted',
    });
    await deleted.service.delete('source_1');
    expect(deleted.storage.delete).not.toHaveBeenCalled();

    const noAsset = setup();
    noAsset.prisma.pdfSource.findUnique.mockResolvedValueOnce({
      id: 'source_1',
      userId: 'user_1',
      assetId: null,
      status: 'deleting',
      activeRevision: 0,
      requestedRevision: 0,
    });
    await noAsset.service.delete('source_1');
    expect(noAsset.storage.delete).not.toHaveBeenCalled();
    expect(noAsset.prisma.pdfSource.updateMany).toHaveBeenCalled();
  });
});
