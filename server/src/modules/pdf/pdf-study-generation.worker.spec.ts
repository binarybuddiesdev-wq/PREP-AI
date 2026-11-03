import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfStudyGenerationWorker } from './pdf-study-generation.worker.js';

const bullMocks = vi.hoisted(() => ({
  handler: undefined as ((job: unknown) => Promise<void>) | undefined,
  on: vi.fn(),
  close: vi.fn(),
}));
vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_name: string, handler: (job: unknown) => Promise<void>) {
      bullMocks.handler = handler;
    }
    on = bullMocks.on;
    close = bullMocks.close;
  },
}));

describe('PdfStudyGenerationWorker', () => {
  afterEach(() => {
    vi.clearAllMocks();
    bullMocks.handler = undefined;
  });

  it('generates PDF questions from queued session IDs and dispatches recovery claims', async () => {
    const config = { get: vi.fn((_key: string, fallback?: unknown) => fallback) };
    const generation = { generate: vi.fn(), markFailed: vi.fn() };
    const postgres = { listQueuedPdfStudySessionIds: vi.fn().mockResolvedValue(['session_1']) };
    const jobs = {
      enqueue: vi.fn().mockResolvedValue('job'),
      getFailedJobs: vi.fn().mockResolvedValue([]),
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = new PdfStudyGenerationWorker(
      config as never,
      generation as never,
      postgres as never,
      jobs as never,
      logger as never
    );
    await worker.onModuleInit();
    await bullMocks.handler?.({
      data: { idempotencyKey: 'pdf-study:session_2', sessionId: 'session_2' },
    });

    expect(jobs.enqueue).toHaveBeenCalledWith(
      'pdf-question-generation-queue',
      { idempotencyKey: 'pdf-study:session_1', sessionId: 'session_1' },
      'generate'
    );
    expect(generation.generate).toHaveBeenCalledWith('session_2');
    await worker.onModuleDestroy();
  });

  it('skips disabled workers and rejects jobs without a session ID', async () => {
    const disabled = new PdfStudyGenerationWorker(
      {
        get: vi.fn((key: string, fallback?: unknown) =>
          key === 'JOBS_WORKER_ENABLED' ? false : fallback
        ),
      } as never,
      { generate: vi.fn(), markFailed: vi.fn() } as never,
      { listQueuedPdfStudySessionIds: vi.fn() } as never,
      { enqueue: vi.fn(), getFailedJobs: vi.fn() } as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );
    await disabled.onModuleInit();
    expect(bullMocks.handler).toBeUndefined();
    await disabled.onModuleDestroy();

    const enabled = new PdfStudyGenerationWorker(
      { get: vi.fn((_key: string, fallback?: unknown) => fallback) } as never,
      { generate: vi.fn(), markFailed: vi.fn() } as never,
      { listQueuedPdfStudySessionIds: vi.fn().mockResolvedValue([]) } as never,
      { enqueue: vi.fn(), getFailedJobs: vi.fn().mockResolvedValue([]) } as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    );
    await enabled.onModuleInit();
    await expect(bullMocks.handler?.({ data: {} })).rejects.toThrow(
      'PDF question generation job has no session ID'
    );
    await enabled.onModuleDestroy();
  });

  it('persists terminal generation failures and logs failed persistence', async () => {
    const generation = {
      generate: vi.fn(),
      markFailed: vi.fn().mockRejectedValue(new Error('database error')),
    };
    const jobs = {
      enqueue: vi.fn().mockRejectedValue(new Error('redis error')),
      getFailedJobs: vi.fn().mockResolvedValue([
        {
          data: { sessionId: 'session_1' },
          remove: vi.fn().mockRejectedValue(new Error('remove failed')),
        },
      ]),
    };
    const postgres = { listQueuedPdfStudySessionIds: vi.fn().mockResolvedValue(['session_2']) };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = new PdfStudyGenerationWorker(
      { get: vi.fn((_key: string, fallback?: unknown) => fallback) } as never,
      generation as never,
      postgres as never,
      jobs as never,
      logger as never
    );
    await worker.onModuleInit();
    const failed = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as
      ((job: unknown, error: Error) => Promise<void>) | undefined;
    const errored = bullMocks.on.mock.calls.find(([event]) => event === 'error')?.[1] as
      ((error: Error) => void) | undefined;
    await failed?.(undefined, new Error('no job'));
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';
    await failed?.(
      { id: 'j', data: { sessionId: 's', requestId }, attemptsMade: 1, opts: { attempts: 2 } },
      new Error('retry')
    );
    await failed?.(
      { id: 'j', data: { sessionId: 's' }, attemptsMade: 2, opts: { attempts: 2 } },
      new Error('final')
    );
    errored?.(new Error('worker'));
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId }),
      'PDF question generation job failed'
    );
    await worker.onModuleDestroy();
  });

  it('handles dispatch query failure without crashing the worker', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const worker = new PdfStudyGenerationWorker(
      { get: vi.fn((_key: string, fallback?: unknown) => fallback) } as never,
      { generate: vi.fn(), markFailed: vi.fn() } as never,
      {
        listQueuedPdfStudySessionIds: vi.fn().mockRejectedValue(new Error('postgres down')),
      } as never,
      { enqueue: vi.fn(), getFailedJobs: vi.fn() } as never,
      logger as never
    );
    await worker.onModuleInit();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(Object),
      'PDF question generation reconciliation failed'
    );
    await worker.onModuleDestroy();
  });
});
