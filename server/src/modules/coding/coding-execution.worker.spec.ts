import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingExecutionWorker } from './coding-execution.worker.js';

const bullMocks = vi.hoisted(() => ({
  on: vi.fn(),
  close: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn(function WorkerMock() {
    return { on: bullMocks.on, close: bullMocks.close };
  }),
}));

describe('CodingExecutionWorker', () => {
  let config: { get: ReturnType<typeof vi.fn> };
  let piston: { execute: ReturnType<typeof vi.fn> };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const jobData = {
    idempotencyKey: 'request-123',
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
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('runs queued code with the bounded worker concurrency and retries', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
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
      data: typeof jobData;
    }) => Promise<unknown>;
    await expect(processJob({ data: jobData })).resolves.toEqual(acceptedResult);
    expect(piston.execute).toHaveBeenCalledWith(jobData.code, jobData.language, jobData.examples);
  });

  it('does not create a worker when the API process is configured producer-only', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'JOBS_WORKER_ENABLED' ? false : key === 'REDIS_HOST' ? 'redis.local' : fallback
    );
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
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
      logger as never
    );
    await worker.onModuleInit();
    const failedHandler = bullMocks.on.mock.calls.find(([event]) => event === 'failed')?.[1] as (
      job: { id: string; attemptsMade: number; data: typeof jobData },
      error: Error
    ) => void;

    failedHandler({ id: 'job-1', attemptsMade: 3, data: jobData }, new Error('Piston unavailable'));

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', attemptsMade: 3 }),
      expect.any(String)
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(jobData.code);
  });

  it('logs worker-level connection errors', async () => {
    const worker = new CodingExecutionWorker(
      config as unknown as ConfigService,
      piston as never,
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
      logger as never
    );
    await worker.onModuleInit();

    await expect(worker.onModuleDestroy()).rejects.toThrow('worker close failed');

    expect(logger.error).toHaveBeenCalledOnce();
  });
});
