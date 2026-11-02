import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingExecutionWorker } from './coding-execution.worker.js';
import { CodingExecutionService } from './coding-execution.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import type { ICodingExecutionJobData } from './coding-execution.types.js';

const bullMocks = vi.hoisted(() => ({
  on: vi.fn(),
  close: vi.fn(),
}));

vi.mock('bullmq', () => ({
  UnrecoverableError: class UnrecoverableErrorMock extends Error {},
  Worker: vi.fn(function WorkerMock() {
    return { on: bullMocks.on, close: bullMocks.close };
  }),
}));

describe('CodingExecutionWorker', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let piston: { execute: ReturnType<typeof vi.fn> };
  let executions: {
    markRunning: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
    findQueuedForDispatch: ReturnType<typeof vi.fn>;
  };
  let redis: { finalizeUniqueQuota: ReturnType<typeof vi.fn> };
  let jobs: {
    enqueue: ReturnType<typeof vi.fn>;
    getFailedJobs: ReturnType<typeof vi.fn>;
  };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const jobData: ICodingExecutionJobData = {
    idempotencyKey: 'request-123',
    executionId: '55555555-5555-4555-8555-555555555555',
    sessionId: '33333333-3333-4333-8333-333333333333',
    userId: 'user_001',
    problemId: '11111111-1111-4111-8111-111111111111',
    operation: 'run' as const,
    quotaReservation: null,
    code: 'secret source code',
    language: 'javascript' as const,
    examples: [{ input: [], output: 1 }],
  };
  const acceptedResult = {
    status: 'accepted',
    testCasesPassed: 1,
    testCasesTotal: 1,
    testCases: [{ input: [], expected: 1, got: 1, passed: true }],
    runtime: null,
    memoryUsage: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.close.mockResolvedValue(undefined);
    config = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key === 'REDIS_HOST' ? 'redis.local' : key === 'REDIS_PORT' ? 6379 : fallback
      ),
    };
    piston = { execute: vi.fn().mockResolvedValue(acceptedResult) };
    executions = {
      markRunning: vi.fn().mockResolvedValue(null),
      complete: vi.fn().mockResolvedValue(acceptedResult),
      markFailed: vi.fn().mockResolvedValue(undefined),
      findQueuedForDispatch: vi.fn().mockResolvedValue([]),
    };
    redis = { finalizeUniqueQuota: vi.fn().mockResolvedValue(undefined) };
    jobs = {
      enqueue: vi.fn().mockResolvedValue('queue-job-id'),
      getFailedJobs: vi.fn().mockResolvedValue([]),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('runs queued code with the bounded worker concurrency and retries', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();

    expect(Worker).toHaveBeenCalledWith(
      'coding-execution-queue',
      expect.any(Function),
      expect.objectContaining({
        concurrency: 5,
        maxStalledCount: 1,
        connection: expect.objectContaining({
          host: 'redis.local',
          port: 6379,
          maxRetriesPerRequest: null,
        }),
      })
    );
    const processJob = vi.mocked(Worker).mock.calls[0][1] as (job: {
      id: string;
      data: typeof jobData;
    }) => Promise<unknown>;
    await expect(processJob({ id: 'queue-job', data: jobData })).resolves.toEqual(acceptedResult);
    expect(piston.execute).toHaveBeenCalledWith(jobData.code, jobData.language, jobData.examples);
    expect(executions.markRunning).toHaveBeenCalledWith(jobData.executionId);
    expect(executions.complete).toHaveBeenCalledWith(jobData, acceptedResult);
  });

  it('re-enqueues durable queued rows on worker startup using deterministic job identity', async () => {
    executions.findQueuedForDispatch.mockResolvedValueOnce([jobData]);
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );

    await worker.onModuleInit();

    expect(jobs.enqueue).toHaveBeenCalledWith('coding-execution-queue', jobData, 'execute');
    await worker.onModuleDestroy();
  });

  it('reuses a persisted result and finalizes a reserved solved quota without re-running Piston', async () => {
    executions.markRunning.mockResolvedValueOnce(acceptedResult);
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const processJob = vi.mocked(Worker).mock.calls[0][1] as (job: {
      id: string;
      data: ICodingExecutionJobData;
    }) => Promise<unknown>;
    const submitData: ICodingExecutionJobData = {
      ...jobData,
      operation: 'submit',
      quotaReservation: {
        quotaKey: 'coding-solved:user_001:2026-11-02',
        itemKey: 'coding-problem:user_001:problem_001',
        ttlSeconds: 3600,
        reservationToken: 'execution-555',
      },
    };

    await expect(processJob({ id: 'queue-job', data: submitData })).resolves.toEqual(
      acceptedResult
    );

    expect(piston.execute).not.toHaveBeenCalled();
    expect(executions.complete).not.toHaveBeenCalled();
    expect(redis.finalizeUniqueQuota).toHaveBeenCalledWith(
      submitData.quotaReservation?.quotaKey,
      submitData.quotaReservation?.itemKey,
      'solved',
      submitData.quotaReservation?.ttlSeconds,
      submitData.quotaReservation?.reservationToken
    );
  });

  it('releases a reserved quota when the persisted result is not accepted', async () => {
    executions.complete.mockResolvedValueOnce({ ...acceptedResult, status: 'wrong_answer' });
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const processJob = vi.mocked(Worker).mock.calls[0][1] as (job: {
      id: string;
      data: ICodingExecutionJobData;
    }) => Promise<unknown>;
    const submitData: ICodingExecutionJobData = {
      ...jobData,
      operation: 'submit',
      quotaReservation: {
        quotaKey: 'coding-solved:user_001:2026-11-02',
        itemKey: 'coding-problem:user_001:problem_001',
        ttlSeconds: 3600,
        reservationToken: 'execution-555',
      },
    };

    await processJob({ id: 'queue-job', data: submitData });

    expect(redis.finalizeUniqueQuota).toHaveBeenCalledWith(
      submitData.quotaReservation?.quotaKey,
      submitData.quotaReservation?.itemKey,
      'release',
      submitData.quotaReservation?.ttlSeconds,
      submitData.quotaReservation?.reservationToken
    );
  });

  it('marks a submission failed without retrying when its session completed during execution', async () => {
    executions.complete.mockRejectedValueOnce(new ConflictException('Session completed'));
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const processJob = vi.mocked(Worker).mock.calls[0][1] as (job: {
      id: string;
      data: ICodingExecutionJobData;
    }) => Promise<unknown>;
    const submitData: ICodingExecutionJobData = {
      ...jobData,
      operation: 'submit',
      quotaReservation: {
        quotaKey: 'coding-solved:user_001:2026-11-02',
        itemKey: 'coding-problem:user_001:problem_001',
        ttlSeconds: 3600,
        reservationToken: 'execution-555',
      },
    };

    await expect(processJob({ id: 'queue-job', data: submitData })).rejects.toBeInstanceOf(
      UnrecoverableError
    );
    expect(piston.execute).toHaveBeenCalledOnce();
    expect(executions.markFailed).toHaveBeenCalledWith(submitData.executionId, expect.any(String));
    expect(redis.finalizeUniqueQuota).toHaveBeenCalledWith(
      submitData.quotaReservation?.quotaKey,
      submitData.quotaReservation?.itemKey,
      'release',
      submitData.quotaReservation?.ttlSeconds,
      submitData.quotaReservation?.reservationToken
    );
  });

  it('logs quota finalization errors without failing a completed execution', async () => {
    redis.finalizeUniqueQuota.mockRejectedValueOnce(new Error('Redis unavailable'));
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const processJob = vi.mocked(Worker).mock.calls[0][1] as (job: {
      id: string;
      data: ICodingExecutionJobData;
    }) => Promise<unknown>;
    const submitData: ICodingExecutionJobData = {
      ...jobData,
      operation: 'submit',
      quotaReservation: {
        quotaKey: 'coding-solved:user_001:2026-11-02',
        itemKey: 'coding-problem:user_001:problem_001',
        ttlSeconds: 3600,
        reservationToken: 'execution-555',
      },
    };

    await expect(processJob({ id: 'queue-job', data: submitData })).resolves.toEqual(
      acceptedResult
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: submitData.executionId }),
      expect.any(String)
    );
  });

  it('does not create a worker when the API process is configured producer-only', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'JOBS_WORKER_ENABLED' ? false : key === 'REDIS_HOST' ? 'redis.local' : fallback
    );
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );

    await worker.onModuleInit();
    await worker.onModuleDestroy();

    expect(Worker).not.toHaveBeenCalled();
  });

  it('logs failed job metadata without logging the submitted code', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: {
        id: string;
        attemptsMade: number;
        opts: { attempts: number };
        data: typeof jobData;
      },
      error: Error
    ) => Promise<void>;

    await failedHandler(
      { id: 'job-1', attemptsMade: 3, opts: { attempts: 3 }, data: jobData },
      new Error('Piston unavailable')
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', attemptsMade: 3 }),
      expect.any(String)
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(jobData.code);
  });

  it('persists terminal failures and releases reserved solve quota', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: {
        id: string;
        attemptsMade: number;
        opts: { attempts: number };
        data: typeof jobData;
      },
      error: Error
    ) => Promise<void>;
    const submitData = {
      ...jobData,
      operation: 'submit' as const,
      quotaReservation: {
        quotaKey: 'coding-solved:user_001:2026-11-02',
        itemKey: 'coding-problem:user_001:problem_001',
        ttlSeconds: 3600,
        reservationToken: 'execution-555',
      },
    };

    await failedHandler(
      { id: 'job-2', attemptsMade: 3, opts: { attempts: 3 }, data: submitData },
      new Error('Piston unavailable')
    );

    expect(executions.markFailed).toHaveBeenCalledWith(submitData.executionId);
    expect(redis.finalizeUniqueQuota).toHaveBeenCalledWith(
      submitData.quotaReservation.quotaKey,
      submitData.quotaReservation.itemKey,
      'release',
      submitData.quotaReservation.ttlSeconds,
      submitData.quotaReservation.reservationToken
    );
  });

  it('does not mark or release a job before its configured final retry', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: {
        id: string;
        attemptsMade: number;
        opts: { attempts: number };
        data: ICodingExecutionJobData;
      },
      error: Error
    ) => Promise<void>;

    await failedHandler(
      { id: 'job-retry', attemptsMade: 1, opts: { attempts: 3 }, data: jobData },
      new Error('temporary Piston failure')
    );

    expect(executions.markFailed).not.toHaveBeenCalled();
    expect(redis.finalizeUniqueQuota).not.toHaveBeenCalled();
  });

  it('marks unrecoverable stalled failures terminal before attempts are exhausted', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: {
        id: string;
        attemptsMade: number;
        opts: { attempts: number };
        data: ICodingExecutionJobData;
      },
      error: Error
    ) => Promise<void>;
    const terminalError = new UnrecoverableError('Job stalled too many times');

    await failedHandler(
      { id: 'job-stalled', attemptsMade: 1, opts: { attempts: 3 }, data: jobData },
      terminalError
    );

    expect(executions.markFailed).toHaveBeenCalledWith(jobData.executionId);
  });

  it('retries terminal database persistence from retained failed BullMQ jobs', async () => {
    vi.useFakeTimers();
    const failedJob = {
      id: 'job-persistence-retry',
      data: {
        ...jobData,
        operation: 'submit' as const,
        quotaReservation: {
          quotaKey: 'coding-solved:user_001:2026-11-02',
          itemKey: 'coding-problem:user_001:problem_001',
          ttlSeconds: 3600,
          reservationToken: 'execution-555',
        },
      },
      remove: vi.fn().mockResolvedValue(undefined),
    };
    jobs.getFailedJobs.mockResolvedValue([failedJob]);
    executions.markFailed.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );

    await worker.onModuleInit();
    expect(failedJob.remove).not.toHaveBeenCalled();

    executions.markFailed.mockResolvedValueOnce(undefined);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(executions.markFailed).toHaveBeenCalledTimes(2);
    expect(redis.finalizeUniqueQuota).toHaveBeenLastCalledWith(
      failedJob.data.quotaReservation.quotaKey,
      failedJob.data.quotaReservation.itemKey,
      'release',
      failedJob.data.quotaReservation.ttlSeconds,
      failedJob.data.quotaReservation.reservationToken
    );
    expect(failedJob.remove).toHaveBeenCalledOnce();
    await worker.onModuleDestroy();
    vi.useRealTimers();
  });

  it('logs worker-level connection errors', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();
    const errorHandler = bullMocks.on.mock.calls.find(([event]) => event === 'error')?.[1] as (
      error: Error
    ) => void;

    errorHandler(new Error('Redis disconnected'));

    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'Coding execution worker encountered an error'
    );
  });

  it('closes the worker during application shutdown', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();

    await worker.onModuleDestroy();

    expect(bullMocks.close).toHaveBeenCalledOnce();
  });

  it('logs and propagates a worker shutdown failure', async () => {
    bullMocks.close.mockRejectedValueOnce(new Error('worker close failed'));
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
      executions as unknown as CodingExecutionService,
      jobs as unknown as JobQueueService,
      redis as unknown as RedisService,
      logger as never
    );
    await worker.onModuleInit();

    await expect(worker.onModuleDestroy()).rejects.toThrow('worker close failed');

    expect(logger.error).toHaveBeenCalledOnce();
  });
});
