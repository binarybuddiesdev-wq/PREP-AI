import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfIngestionWorker } from './pdf-ingestion.worker.js';

const bullMocks = vi.hoisted(() => ({
  workerHandler: undefined as ((job: unknown) => Promise<void>) | undefined,
  workerOn: vi.fn(),
  workerClose: vi.fn(),
  worker: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_name: string, handler: (job: unknown) => Promise<void>) {
      bullMocks.worker(handler);
      bullMocks.workerHandler = handler;
    }
    on = bullMocks.workerOn;
    close = bullMocks.workerClose;
  },
}));

describe('PdfIngestionWorker', () => {
  afterEach(() => {
    vi.clearAllMocks();
    bullMocks.workerHandler = undefined;
  });

  it('dispatches ingest jobs to the indexer and deletion jobs to cleanup', async () => {
    const config = { get: vi.fn((_key: string, fallback?: unknown) => fallback) };
    const indexing = { ingest: vi.fn(), delete: vi.fn(), markFailed: vi.fn() };
    const pdfs = { dispatchRecoverableSources: vi.fn() };
    const jobs = { getFailedJobs: vi.fn().mockResolvedValue([]) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = new PdfIngestionWorker(
      config as never,
      indexing as never,
      pdfs as never,
      jobs as never,
      logger as never
    );
    await worker.onModuleInit();

    await bullMocks.workerHandler?.({
      name: 'ingest',
      data: { idempotencyKey: 'pdf:source_1:1', sourceId: 'source_1', revision: 1 },
    });
    await bullMocks.workerHandler?.({ name: 'delete', data: { sourceId: 'source_1' } });

    expect(indexing.ingest).toHaveBeenCalledWith('source_1', 1);
    expect(indexing.delete).toHaveBeenCalledWith('source_1');
    await worker.onModuleDestroy();
  });

  it('skips worker startup when worker execution is disabled', async () => {
    const config = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key === 'JOBS_WORKER_ENABLED' ? false : fallback
      ),
    };
    const worker = new PdfIngestionWorker(
      config as never,
      { ingest: vi.fn(), delete: vi.fn(), markFailed: vi.fn() } as never,
      { dispatchRecoverableSources: vi.fn() } as never,
      { getFailedJobs: vi.fn() } as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );
    await worker.onModuleInit();
    expect(bullMocks.worker).not.toHaveBeenCalled();
    await worker.onModuleDestroy();
  });

  it('rejects invalid jobs and handles worker event errors and final retry failures', async () => {
    const indexing = { ingest: vi.fn(), delete: vi.fn(), markFailed: vi.fn() };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = new PdfIngestionWorker(
      { get: vi.fn((_key: string, fallback?: unknown) => fallback) } as never,
      indexing as never,
      { dispatchRecoverableSources: vi.fn() } as never,
      { getFailedJobs: vi.fn().mockResolvedValue([]) } as never,
      logger as never
    );
    await worker.onModuleInit();
    await expect(
      bullMocks.workerHandler?.({ name: 'ingest', data: { sourceId: '', revision: 0 } })
    ).rejects.toThrow('PDF ingestion job is invalid');
    const failedHandler = bullMocks.workerOn.mock.calls.find(
      ([event]) => event === 'failed'
    )?.[1] as ((job: unknown, error: Error) => Promise<void>) | undefined;
    const errorHandler = bullMocks.workerOn.mock.calls.find(([event]) => event === 'error')?.[1] as
      ((error: Error) => void) | undefined;
    await failedHandler?.(
      {
        id: 'job',
        name: 'ingest',
        data: { sourceId: 's', revision: 1 },
        attemptsMade: 1,
        opts: { attempts: 2 },
      },
      new Error('retry')
    );
    expect(indexing.markFailed).not.toHaveBeenCalled();
    indexing.markFailed.mockRejectedValueOnce(new Error('db down'));
    await failedHandler?.(
      {
        id: 'job',
        name: 'ingest',
        data: { sourceId: 's', revision: 1 },
        attemptsMade: 2,
        opts: { attempts: 2 },
      },
      new Error('final')
    );
    errorHandler?.(new Error('worker error'));
    expect(indexing.markFailed).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalled();
    await worker.onModuleDestroy();
  });
});
