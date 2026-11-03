import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingReviewWorker } from './coding-review.worker.js';
import { CodingReviewService } from './coding-review.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import type { ICodingReviewJobData } from './coding-review.types.js';

const bullMocks = vi.hoisted(() => ({ on: vi.fn(), close: vi.fn() }));

vi.mock('bullmq', () => ({
  Worker: vi.fn(function WorkerMock() {
    return { on: bullMocks.on, close: bullMocks.close };
  }),
}));

describe('CodingReviewWorker', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let reviews: {
    review: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    findQueuedForDispatch: ReturnType<typeof vi.fn>;
  };
  let jobs: { enqueue: ReturnType<typeof vi.fn>; getFailedJobs: ReturnType<typeof vi.fn> };
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const reviewJob: ICodingReviewJobData = {
    idempotencyKey: '55555555-5555-4555-8555-555555555555',
    executionId: '55555555-5555-4555-8555-555555555555',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.close.mockResolvedValue(undefined);
    config = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key === 'REDIS_HOST' ? 'redis.local' : key === 'REDIS_PORT' ? 6379 : fallback
      ),
    };
    reviews = {
      review: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      findQueuedForDispatch: vi.fn().mockResolvedValue([]),
    };
    jobs = {
      enqueue: vi.fn().mockResolvedValue('job-id'),
      getFailedJobs: vi.fn().mockResolvedValue([]),
    };
    logger = { warn: vi.fn(), error: vi.fn() };
  });

  const createWorker = () =>
    new CodingReviewWorker(
      config as unknown as ConfigService,
      reviews as unknown as CodingReviewService,
      jobs as unknown as JobQueueService,
      logger as never
    );

  it('consumes the bounded review queue and processes only the persisted execution ID', async () => {
    const worker = createWorker();
    await worker.onModuleInit();

    expect(Worker).toHaveBeenCalledWith(
      'code-review-queue',
      expect.any(Function),
      expect.objectContaining({ concurrency: 3, maxStalledCount: 1 })
    );
    const processJob = vi.mocked(Worker).mock.calls[0]?.[1] as (job: {
      data: ICodingReviewJobData;
    }) => Promise<void>;
    await processJob({ data: reviewJob });
    expect(reviews.review).toHaveBeenCalledWith(reviewJob.executionId);
    expect(JSON.stringify(reviewJob)).not.toContain('sourceCode');
    await worker.onModuleDestroy();
  });

  it('re-dispatches durable queued reviews on startup with deterministic job identity', async () => {
    reviews.findQueuedForDispatch.mockResolvedValueOnce([reviewJob]);
    const worker = createWorker();

    await worker.onModuleInit();

    expect(jobs.enqueue).toHaveBeenCalledWith('code-review-queue', reviewJob, 'review');
    await worker.onModuleDestroy();
  });

  it('marks a review failed only after the queue exhausts its configured attempts', async () => {
    const worker = createWorker();
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: Pick<Job<ICodingReviewJobData>, 'data' | 'attemptsMade' | 'opts'>,
      error: Error
    ) => Promise<void>;
    await failedHandler(
      { data: reviewJob, attemptsMade: 2, opts: { attempts: 3 } } as never,
      new Error('retry')
    );
    expect(reviews.markFailed).not.toHaveBeenCalled();
    await failedHandler(
      { data: reviewJob, attemptsMade: 3, opts: { attempts: 3 } } as never,
      new Error('terminal')
    );
    expect(reviews.markFailed).toHaveBeenCalledWith(reviewJob.executionId);
    await worker.onModuleDestroy();
  });

  it('includes the originating request ID in failed job logs', async () => {
    const worker = createWorker();
    await worker.onModuleInit();
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: Pick<Job<ICodingReviewJobData>, 'data' | 'attemptsMade' | 'opts'>,
      error: Error
    ) => Promise<void>;

    await failedHandler(
      {
        data: { ...reviewJob, requestId },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as never,
      new Error('retry')
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ requestId }),
      'Coding review job failed'
    );
    await worker.onModuleDestroy();
  });

  it('keeps the worker disabled when the process is configured as producer-only', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'JOBS_WORKER_ENABLED' ? false : fallback
    );
    const worker = createWorker();

    await worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(Worker).not.toHaveBeenCalled();
    expect(jobs.getFailedJobs).not.toHaveBeenCalled();
  });

  it('retries queued and terminal reconciliation failures without rejecting startup', async () => {
    jobs.getFailedJobs.mockResolvedValueOnce([
      {
        data: reviewJob,
        id: 'failed-review',
        remove: vi.fn().mockRejectedValue(new Error('redis unavailable')),
      },
    ]);
    reviews.findQueuedForDispatch.mockResolvedValueOnce([reviewJob]);
    jobs.enqueue.mockRejectedValueOnce(new Error('redis unavailable'));
    const worker = createWorker();

    await expect(worker.onModuleInit()).resolves.toBeUndefined();

    expect(reviews.markFailed).toHaveBeenCalledWith(reviewJob.executionId);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: reviewJob.executionId }),
      'Failed to reconcile a terminal code review; it will be retried'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: reviewJob.executionId }),
      'Failed to dispatch a queued code review; it will be retried'
    );
    await worker.onModuleDestroy();
  });

  it('logs terminal review persistence failures and queue read failures', async () => {
    reviews.markFailed.mockRejectedValueOnce(new Error('database unavailable'));
    jobs.getFailedJobs.mockRejectedValueOnce(new Error('redis unavailable'));
    reviews.findQueuedForDispatch.mockRejectedValueOnce(new Error('database unavailable'));
    const worker = createWorker();
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: Pick<Job<ICodingReviewJobData>, 'data' | 'attemptsMade' | 'opts'> | undefined,
      error: Error
    ) => Promise<void>;

    await failedHandler(undefined, new Error('stalled'));
    await failedHandler(
      { data: reviewJob, attemptsMade: 3, opts: { attempts: 3 } } as never,
      new Error('terminal')
    );
    await failedHandler(
      { data: reviewJob, attemptsMade: 1, opts: {} } as never,
      new Error('default attempts')
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: reviewJob.executionId }),
      'Failed to persist terminal coding review failure'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Failed to read terminal code review jobs'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Failed to read queued code reviews for dispatch'
    );
    await worker.onModuleDestroy();
  });

  it('logs worker errors and rethrows failed shutdowns', async () => {
    bullMocks.close.mockRejectedValueOnce(new Error('close failed'));
    const worker = createWorker();
    await worker.onModuleInit();
    const errorHandler = bullMocks.on.mock.calls.find(([event]) => event === 'error')?.[1] as (
      error: Error
    ) => void;
    errorHandler(new Error('connection lost'));

    await expect(worker.onModuleDestroy()).rejects.toThrow('close failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Coding review worker encountered an error'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Coding review worker may remain open during shutdown'
    );
  });
});
