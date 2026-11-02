import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobQueueService } from './job-queue.service.js';
import { JOB_QUEUE_NAMES } from './job-queue.constants.js';

const bullMocks = vi.hoisted(() => ({
  add: vi.fn(),
  queueClose: vi.fn(),
  eventsClose: vi.fn(),
  waitUntilFinished: vi.fn(),
  queueOn: vi.fn(),
  eventsOn: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(function QueueMock() {
    return { add: bullMocks.add, close: bullMocks.queueClose, on: bullMocks.queueOn };
  }),
  QueueEvents: vi.fn(function QueueEventsMock() {
    return { close: bullMocks.eventsClose, on: bullMocks.eventsOn };
  }),
}));

describe('JobQueueService', () => {
  let service: JobQueueService;
  let config: { get: ReturnType<typeof vi.fn> };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  const executionData = {
    idempotencyKey: 'request-123',
    code: 'function solution() { return 1; }',
    language: 'javascript' as const,
    examples: [{ input: [], output: 1 }],
  };
  const acceptedResult = {
    status: 'accepted' as const,
    testCasesPassed: 1,
    testCasesTotal: 1,
    testCases: [{ input: [], expected: 1, got: 1, passed: true }],
    runtime: null,
    memoryUsage: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.add.mockResolvedValue({ waitUntilFinished: bullMocks.waitUntilFinished });
    bullMocks.waitUntilFinished.mockResolvedValue(acceptedResult);
    bullMocks.queueClose.mockResolvedValue(undefined);
    bullMocks.eventsClose.mockResolvedValue(undefined);
    config = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key === 'REDIS_HOST' ? 'redis.local' : key === 'REDIS_PORT' ? 6379 : fallback
      ),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service = new JobQueueService(config as unknown as ConfigService, logger as never);
  });

  it('queues code with retry, exponential backoff, retention, and a Redis-safe idempotent job ID', async () => {
    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).resolves.toEqual(acceptedResult);

    expect(Queue).toHaveBeenCalledWith(
      JOB_QUEUE_NAMES.CODING_EXECUTION,
      expect.objectContaining({
        connection: expect.objectContaining({ host: 'redis.local', port: 6379 }),
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 604800, count: 1000 },
          removeOnFail: { age: 604800, count: 5000 },
        }),
      })
    );
    expect(bullMocks.add).toHaveBeenCalledWith('execute', executionData, {
      jobId: 'a8c0f40f9449f2b7be3547fb5a3ca710dd537068e52cd653776b7fed3b99b173',
    });
    expect(bullMocks.waitUntilFinished).toHaveBeenCalledWith(expect.any(Object), 30_000);
  });

  it('maps Redis enqueue failures to a 503 without leaking the source code', async () => {
    bullMocks.add.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: executionData.code }),
      expect.any(String)
    );
  });

  it('logs producer and QueueEvents connection failures', () => {
    const queueErrorHandler = bullMocks.queueOn.mock.calls[0][1] as (error: Error) => void;
    const eventsErrorHandler = bullMocks.eventsOn.mock.calls[0][1] as (error: Error) => void;
    const error = new Error('Redis disconnected');

    queueErrorHandler(error);
    eventsErrorHandler(error);

    expect(logger.error).toHaveBeenCalledWith(
      { queueName: JOB_QUEUE_NAMES.THEORY_EVALUATION, err: error },
      'Background job queue connection failed'
    );
    expect(logger.error).toHaveBeenCalledWith(
      { queueName: JOB_QUEUE_NAMES.THEORY_EVALUATION, err: error },
      'Background job event connection failed'
    );
  });

  it('maps worker failure and timeout to a 503', async () => {
    bullMocks.waitUntilFinished.mockRejectedValueOnce(new Error('worker failed'));
    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    bullMocks.waitUntilFinished.mockRejectedValueOnce(new Error('timeout'));
    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('closes the producer and result-event connections during shutdown', async () => {
    await service.onModuleDestroy();

    expect(bullMocks.queueClose).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
    expect(bullMocks.eventsClose).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
  });

  it('closes every connection and reports a shutdown failure', async () => {
    bullMocks.queueClose.mockRejectedValueOnce(new Error('connection close failed'));

    await expect(service.onModuleDestroy()).rejects.toBeInstanceOf(AggregateError);

    expect(bullMocks.queueClose).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
    expect(bullMocks.eventsClose).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
