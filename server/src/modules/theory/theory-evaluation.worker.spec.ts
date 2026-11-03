import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';
import { TheoryEvaluationWorker } from './theory-evaluation.worker.js';
import type { ITheoryEvaluationJobData } from './theory-evaluation.types.js';

const bullMocks = vi.hoisted(() => ({ on: vi.fn(), close: vi.fn() }));

vi.mock('bullmq', () => ({
  Worker: vi.fn(function WorkerMock() {
    return { on: bullMocks.on, close: bullMocks.close };
  }),
}));

describe('TheoryEvaluationWorker', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let evaluations: {
    evaluate: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    findQueuedForDispatch: ReturnType<typeof vi.fn>;
  };
  let jobs: {
    enqueue: ReturnType<typeof vi.fn>;
    getFailedJobs: ReturnType<typeof vi.fn>;
  };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const jobData: ITheoryEvaluationJobData = {
    idempotencyKey: 'answer_001',
    answerId: 'answer_001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.close.mockResolvedValue(undefined);
    config = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key === 'REDIS_HOST' ? 'redis.local' : key === 'REDIS_PORT' ? 6379 : fallback
      ),
    };
    evaluations = {
      evaluate: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      findQueuedForDispatch: vi.fn().mockResolvedValue([]),
    };
    jobs = {
      enqueue: vi.fn().mockResolvedValue('job_001'),
      getFailedJobs: vi.fn().mockResolvedValue([]),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('processes durable jobs and dispatches queued answers after worker startup', async () => {
    evaluations.findQueuedForDispatch.mockResolvedValueOnce([jobData]);
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );

    await worker.onModuleInit();

    expect(Worker).toHaveBeenCalledWith(
      'theory-eval-queue',
      expect.any(Function),
      expect.objectContaining({ concurrency: 5, maxStalledCount: 1 })
    );
    expect(jobs.enqueue).toHaveBeenCalledWith('theory-eval-queue', jobData, 'evaluate');
    const processJob = vi.mocked(Worker).mock.calls[0][1] as (
      job: Job<ITheoryEvaluationJobData>
    ) => Promise<void>;
    await processJob({ data: jobData } as Job<ITheoryEvaluationJobData>);
    expect(evaluations.evaluate).toHaveBeenCalledWith('answer_001');
    await worker.onModuleDestroy();
  });

  it('persists terminal failure after the final BullMQ attempt', async () => {
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: Job<ITheoryEvaluationJobData>,
      error: Error
    ) => Promise<void>;
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';
    const job = {
      id: 'job_001',
      data: { ...jobData, requestId },
      attemptsMade: 3,
      opts: { attempts: 3 },
    };

    await failedHandler(job as Job<ITheoryEvaluationJobData>, new Error('provider failed'));

    expect(evaluations.markFailed).toHaveBeenCalledWith('answer_001');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_001',
        attemptsMade: 3,
        errorName: 'Error',
        requestId,
      }),
      'Theory evaluation job failed'
    );
    await worker.onModuleDestroy();
  });

  it('does not create a worker when background processing is disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'JOBS_WORKER_ENABLED' ? false : fallback
    );
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );

    await worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(Worker).not.toHaveBeenCalled();
  });

  it('does not mark an answer failed before its last retry', async () => {
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: Job<ITheoryEvaluationJobData> | undefined,
      error: Error
    ) => Promise<void>;

    await failedHandler(
      {
        id: 'job_001',
        data: jobData,
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as Job<ITheoryEvaluationJobData>,
      new Error('transient failure')
    );
    await failedHandler(undefined, new Error('job disappeared'));

    expect(evaluations.markFailed).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });

  it('reconciles retained failed jobs after persisting the terminal status', async () => {
    const failedJob = {
      id: 'failed-job',
      data: jobData,
      remove: vi.fn().mockResolvedValue(undefined),
    };
    jobs.getFailedJobs.mockResolvedValueOnce([failedJob]);
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );

    await worker.onModuleInit();

    expect(evaluations.markFailed).toHaveBeenCalledWith('answer_001');
    expect(failedJob.remove).toHaveBeenCalledOnce();
    await worker.onModuleDestroy();
  });

  it('logs a queued dispatch failure and leaves the database row for the next scan', async () => {
    evaluations.findQueuedForDispatch.mockResolvedValueOnce([jobData]);
    jobs.enqueue.mockRejectedValueOnce(new Error('redis unavailable'));
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );

    await worker.onModuleInit();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ answerId: 'answer_001' }),
      'Failed to dispatch a queued theory evaluation; it will be retried'
    );
    await worker.onModuleDestroy();
  });

  it('logs worker infrastructure errors without answer payloads', async () => {
    const worker = new TheoryEvaluationWorker(
      config as unknown as ConfigService,
      evaluations as unknown as TheoryEvaluationService,
      jobs as unknown as JobQueueService,
      logger as never
    );
    await worker.onModuleInit();
    const errorHandler = bullMocks.on.mock.calls.find(([event]) => event === 'error')?.[1] as (
      error: Error
    ) => void;
    const workerError = new Error('redis connection dropped');

    errorHandler(workerError);

    expect(logger.error).toHaveBeenCalledWith(
      { err: workerError },
      'Theory evaluation worker encountered an error'
    );
    await worker.onModuleDestroy();
  });
});
