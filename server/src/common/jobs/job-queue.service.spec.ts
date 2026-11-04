import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobQueueService } from './job-queue.service.js';
import { JOB_QUEUE_NAMES } from './job-queue.constants.js';
import { runWithRequestId } from '../request-context/request-context.js';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

const bullMocks = vi.hoisted(() => ({
  add: vi.fn(),
  queueClose: vi.fn(),
  queueOn: vi.fn(),
  getJobs: vi.fn(),
  getJob: vi.fn(),
  getJobCounts: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn(function QueueMock() {
    return {
      add: bullMocks.add,
      close: bullMocks.queueClose,
      on: bullMocks.queueOn,
      getJobs: bullMocks.getJobs,
      getJob: bullMocks.getJob,
      getJobCounts: bullMocks.getJobCounts,
    };
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
  beforeEach(() => {
    vi.clearAllMocks();
    bullMocks.add.mockResolvedValue({ id: 'queue-job-id' });
    bullMocks.queueClose.mockResolvedValue(undefined);
    config = {
      get: vi.fn((key: string, fallback?: unknown) =>
        key === 'REDIS_HOST' ? 'redis.local' : key === 'REDIS_PORT' ? 6379 : fallback
      ),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service = new JobQueueService(config as unknown as ConfigService, logger as never);
  });

  it('queues code and immediately returns its queue job ID with retry, backoff, and retention', async () => {
    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).resolves.toEqual('queue-job-id');

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
    expect(bullMocks.add).toHaveBeenCalledOnce();
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

  it('returns the deterministic job ID when BullMQ does not include an ID', async () => {
    bullMocks.add.mockResolvedValueOnce({});

    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).resolves.toBe('a8c0f40f9449f2b7be3547fb5a3ca710dd537068e52cd653776b7fed3b99b173');
  });

  it('adds the current request ID to the queued job payload', async () => {
    const requestId = '8d2f6b25-35f4-4cb7-97d1-310eaf8cd4b3';

    await runWithRequestId(requestId, () =>
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    );

    expect(bullMocks.add).toHaveBeenCalledWith(
      'execute',
      { ...executionData, requestId },
      expect.objectContaining({ jobId: expect.any(String) })
    );
  });

  it('adds W3C trace context to queued job metadata without changing its job ID', async () => {
    const activeContext = trace.setSpanContext(context.active(), {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
    });

    await context.with(activeContext, () =>
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    );

    expect(bullMocks.add).toHaveBeenCalledWith(
      'execute',
      {
        ...executionData,
        traceContext: {
          traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        },
      },
      { jobId: 'a8c0f40f9449f2b7be3547fb5a3ca710dd537068e52cd653776b7fed3b99b173' }
    );
  });

  it('does not add request metadata to jobs enqueued without an HTTP context', async () => {
    await service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute');

    expect(bullMocks.add).toHaveBeenCalledWith(
      'execute',
      executionData,
      expect.objectContaining({ jobId: expect.any(String) })
    );
  });

  it('exposes retained failed jobs for durable execution reconciliation', async () => {
    const failedJobs = [{ id: 'failed-job' }];
    bullMocks.getJobs.mockResolvedValueOnce(failedJobs);

    await expect(service.getFailedJobs(JOB_QUEUE_NAMES.CODING_EXECUTION, 25)).resolves.toBe(
      failedJobs
    );
    expect(bullMocks.getJobs).toHaveBeenCalledWith(['failed'], 0, 24);
  });

  it('retries an existing failed deterministic job during reconciliation', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    bullMocks.getJob.mockResolvedValueOnce({
      getState: vi.fn().mockResolvedValue('failed'),
      retry,
      id: 'existing-job',
    });

    await expect(
      service.enqueue(JOB_QUEUE_NAMES.PAYMENT_RECONCILIATION, executionData, 'reconcile', true)
    ).resolves.toBe('existing-job');

    expect(retry).toHaveBeenCalledWith('failed');
    expect(bullMocks.add).not.toHaveBeenCalled();
  });

  it('reads fixed state counts for every registered queue', async () => {
    bullMocks.getJobCounts.mockImplementation(async (...states: string[]) =>
      Object.fromEntries(states.map((state) => [state, state === 'waiting' ? 2 : 0]))
    );

    const result = await service.getJobCounts();

    expect(Object.keys(result).sort()).toEqual(Object.values(JOB_QUEUE_NAMES).sort());
    expect(bullMocks.getJobCounts).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
    expect(bullMocks.getJobCounts).toHaveBeenCalledWith(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    expect(result[JOB_QUEUE_NAMES.THEORY_EVALUATION]).toEqual({
      waiting: 2,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });
  });

  it('logs producer connection failures', () => {
    const queueErrorHandler = bullMocks.queueOn.mock.calls[0][1] as (error: Error) => void;
    const error = new Error('Redis disconnected');

    queueErrorHandler(error);

    expect(logger.error).toHaveBeenCalledWith(
      { queueName: JOB_QUEUE_NAMES.THEORY_EVALUATION, err: error },
      'Background job queue connection failed'
    );
  });

  it('maps queue submission failures to a 503', async () => {
    bullMocks.add.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(
      service.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, executionData, 'execute')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('closes producer connections during shutdown', async () => {
    await service.onModuleDestroy();

    expect(bullMocks.queueClose).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
  });

  it('closes every connection and reports a shutdown failure', async () => {
    bullMocks.queueClose.mockRejectedValueOnce(new Error('connection close failed'));

    await expect(service.onModuleDestroy()).rejects.toBeInstanceOf(AggregateError);

    expect(bullMocks.queueClose).toHaveBeenCalledTimes(Object.keys(JOB_QUEUE_NAMES).length);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
