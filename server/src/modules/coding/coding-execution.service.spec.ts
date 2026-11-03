import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { CodingExecutionService } from './coding-execution.service.js';
import type { ICodingExecutionJobData } from './coding-execution.types.js';

describe('CodingExecutionService', () => {
  let service: CodingExecutionService;
  let postgres: {
    client_: Record<string, unknown>;
    workerClient_: Record<string, unknown>;
    withWorkerJobContext: (jobId: string, operation: (tx: unknown) => unknown) => Promise<unknown>;
    setTenantContext: ReturnType<typeof vi.fn>;
    setWorkerSessionContext: ReturnType<typeof vi.fn>;
  };
  let execution: Record<string, unknown>;
  type TMockModel = Record<string, ReturnType<typeof vi.fn>>;
  let pg: {
    codingExecution: TMockModel;
    codingSession: TMockModel;
    codingAnswer: TMockModel;
    $transaction: ((callback: (tx: unknown) => unknown) => unknown) & ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const jobData: ICodingExecutionJobData = {
    idempotencyKey: 'execution-001',
    executionId: '55555555-5555-4555-8555-555555555555',
    sessionId: '33333333-3333-4333-8333-333333333333',
    userId: 'user_001',
    problemId: '11111111-1111-4111-8111-111111111111',
    operation: 'run',
    language: 'javascript',
    code: 'function solution() { return 1; }',
    examples: [{ input: [], output: 1 }],
    quotaReservation: null,
  };
  const result = {
    status: 'accepted' as const,
    testCasesPassed: 1,
    testCasesTotal: 1,
    testCases: [{ input: [], expected: 1, got: 1, passed: true }],
    runtime: null,
    memoryUsage: null,
  };

  beforeEach(async () => {
    execution = {
      id: jobData.executionId,
      sessionId: jobData.sessionId,
      userId: jobData.userId,
      problemId: jobData.problemId,
      operation: jobData.operation,
      language: jobData.language,
      sourceCode: jobData.code,
      examples: jobData.examples,
      quotaKey: null,
      quotaItemKey: null,
      quotaTtlSeconds: null,
      quotaReservationToken: null,
      status: 'queued',
      result: null,
    };
    const codingExecution = {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(execution)),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        execution = { ...execution, ...data };
        return Promise.resolve({ count: 1 });
      }),
    };
    const codingSession = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const codingAnswer = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'answer-001' }),
    };
    pg = {
      codingExecution,
      codingSession,
      codingAnswer,
      $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
        callback({
          codingExecution,
          codingSession,
          codingAnswer,
          $queryRaw: vi.fn(async () => [
            { owner_id: jobData.userId, session_id: jobData.sessionId },
          ]),
        })
      ),
      $queryRaw: vi.fn(async () => [{ owner_id: jobData.userId, session_id: jobData.sessionId }]),
    };
    postgres = {
      client_: pg as unknown as Record<string, unknown>,
      workerClient_: pg as unknown as Record<string, unknown>,
      withWorkerJobContext: vi.fn(async (_jobId: string, operation: (tx: unknown) => unknown) =>
        pg.$transaction(operation)
      ),
      setTenantContext: vi.fn(),
      setWorkerSessionContext: vi.fn(),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CodingExecutionService,
        { provide: PrismaPostgresqlService, useValue: postgres },
        { provide: 'PinoLogger:CodingExecutionService', useValue: logger },
      ],
    }).compile();
    service = module.get(CodingExecutionService);
  });

  it('marks a queued execution running before the processor starts', async () => {
    await expect(service.markRunning(jobData.executionId)).resolves.toBeNull();
    expect(pg.codingExecution.updateMany).toHaveBeenCalledWith({
      where: { id: jobData.executionId, userId: jobData.userId, status: 'queued' },
      data: {
        status: 'running',
        startedAt: expect.any(Date),
        dispatchClaimedAt: null,
      },
    });
  });

  it('returns the stored result when a completed job is delivered again', async () => {
    execution = { status: 'completed', result };

    await expect(service.markRunning(jobData.executionId)).resolves.toEqual(result);
    expect(pg.codingExecution.updateMany).not.toHaveBeenCalled();
  });

  it('does not replace a running state on a delivery retry', async () => {
    execution = { status: 'running', result: null };

    await expect(service.markRunning(jobData.executionId)).resolves.toBeNull();
    expect(pg.codingExecution.updateMany).not.toHaveBeenCalled();
  });

  it('maps a missing execution row to a service-unavailable failure for the worker retry', async () => {
    pg.codingExecution.findUnique.mockResolvedValueOnce(null);

    await expect(service.markRunning(jobData.executionId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('does not process a job after its execution has become terminally failed', async () => {
    execution = { status: 'failed', result: null };

    await expect(service.markRunning(jobData.executionId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(pg.codingExecution.updateMany).not.toHaveBeenCalled();
  });

  it('reconstructs queued jobs from durable execution rows after a worker restart', async () => {
    execution = {
      ...execution,
      operation: 'submit',
      quotaKey: 'quota-key',
      quotaItemKey: 'item-key',
      quotaTtlSeconds: 180,
      quotaReservationToken: jobData.executionId,
    };
    (pg as unknown as { $queryRaw: ReturnType<typeof vi.fn> }).$queryRaw.mockResolvedValueOnce([
      { execution_id: jobData.executionId },
    ]);

    await expect(service.findQueuedForDispatch()).resolves.toEqual([
      {
        ...jobData,
        idempotencyKey: jobData.executionId,
        operation: 'submit',
        quotaReservation: {
          quotaKey: 'quota-key',
          itemKey: 'item-key',
          ttlSeconds: 180,
          reservationToken: jobData.executionId,
        },
      },
    ]);
    expect((pg as unknown as { $queryRaw: ReturnType<typeof vi.fn> }).$queryRaw).toHaveBeenCalled();
  });
  it('persists a run result inside a transaction', async () => {
    await expect(service.complete(jobData, result)).resolves.toEqual(result);
    expect(pg.$transaction).toHaveBeenCalledOnce();
    expect(pg.codingExecution.updateMany).toHaveBeenCalledWith({
      where: {
        id: jobData.executionId,
        userId: jobData.userId,
        status: { in: ['queued', 'running'] },
      },
      data: expect.objectContaining({ status: 'completed', result }),
    });
    expect(pg.codingAnswer.create).not.toHaveBeenCalled();
  });

  it('returns the committed result when another delivery completes before this transaction', async () => {
    pg.codingExecution.updateMany.mockResolvedValueOnce({ count: 0 });
    pg.codingExecution.findUnique.mockResolvedValueOnce(execution).mockResolvedValueOnce({
      status: 'completed',
      result,
    });

    await expect(service.complete(jobData, result)).resolves.toEqual(result);
  });

  it('fails for a missing execution record instead of discarding the result', async () => {
    pg.codingExecution.findUnique.mockResolvedValueOnce(null);

    await expect(service.complete(jobData, result)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('does not complete an execution that is already terminally failed', async () => {
    pg.codingExecution.findUnique.mockResolvedValueOnce({ status: 'failed', result: null });

    await expect(service.complete(jobData, result)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(pg.codingExecution.updateMany).not.toHaveBeenCalled();
  });

  it('reports a lost state transition when no completed record can be reloaded', async () => {
    pg.codingExecution.updateMany.mockResolvedValueOnce({ count: 0 });
    pg.codingExecution.findUnique.mockResolvedValueOnce(execution).mockResolvedValueOnce(null);

    await expect(service.complete(jobData, result)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('maps unexpected transaction errors to a service-unavailable exception', async () => {
    pg.$transaction.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));

    await expect(service.complete(jobData, result)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('creates one answer and updates session counters atomically for a submission', async () => {
    const submitData = { ...jobData, operation: 'submit' as const };
    execution.operation = 'submit';

    await expect(service.complete(submitData, result)).resolves.toEqual(result);

    expect(pg.codingSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: submitData.sessionId, userId: submitData.userId, status: 'in_progress' },
      data: { problemsAttempted: { increment: 1 } },
    });
    expect(pg.codingSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: submitData.sessionId, userId: submitData.userId, status: 'in_progress' },
      data: { problemsSolved: { increment: 1 } },
    });
    expect(pg.codingAnswer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        executionId: submitData.executionId,
        sessionId: submitData.sessionId,
        userId: submitData.userId,
        problemId: submitData.problemId,
        code: submitData.code,
        status: 'accepted',
      }),
    });
  });

  it('does not create another answer when a submission retry sees a committed result', async () => {
    execution = { status: 'completed', result };
    const submitData = { ...jobData, operation: 'submit' as const };

    await expect(service.complete(submitData, result)).resolves.toEqual(result);
    expect(pg.codingSession.updateMany).not.toHaveBeenCalled();
    expect(pg.codingAnswer.create).not.toHaveBeenCalled();
  });

  it('does not increment solved count when the problem already has an accepted answer', async () => {
    pg.codingAnswer.findFirst.mockResolvedValueOnce({ id: 'prior-answer' });
    const submitData = { ...jobData, operation: 'submit' as const };
    execution.operation = 'submit';

    await service.complete(submitData, result);

    expect(pg.codingSession.updateMany).toHaveBeenCalledOnce();
    expect(pg.codingAnswer.create).toHaveBeenCalledOnce();
  });

  it('creates a wrong-answer record without looking up or incrementing solved answers', async () => {
    const wrongResult = { ...result, status: 'wrong_answer' as const };
    const submitData = { ...jobData, operation: 'submit' as const };
    execution.operation = 'submit';

    await service.complete(submitData, wrongResult);

    expect(pg.codingAnswer.findFirst).not.toHaveBeenCalled();
    expect(pg.codingSession.updateMany).toHaveBeenCalledOnce();
    expect(pg.codingAnswer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'wrong_answer' }),
    });
  });

  it('rolls back finalization if the session was completed before the worker committed', async () => {
    pg.codingSession.updateMany.mockResolvedValueOnce({ count: 0 });
    const submitData = { ...jobData, operation: 'submit' as const };
    execution.operation = 'submit';

    await expect(service.complete(submitData, result)).rejects.toBeInstanceOf(ConflictException);
    expect(pg.codingAnswer.create).not.toHaveBeenCalled();
  });

  it('marks executions failed only while they are still active', async () => {
    await service.markFailed(jobData.executionId);

    expect(pg.codingExecution.updateMany).toHaveBeenCalledWith({
      where: {
        id: jobData.executionId,
        userId: jobData.userId,
        status: { in: ['queued', 'running'] },
      },
      data: expect.objectContaining({ status: 'failed', completedAt: expect.any(Date) }),
    });
  });

  it('fails with 503 if the PostgreSQL client is unavailable', async () => {
    postgres.client_ = undefined as unknown as Record<string, unknown>;
    postgres.workerClient_ = undefined as unknown as Record<string, unknown>;
    postgres.withWorkerJobContext = vi.fn().mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(service.markFailed(jobData.executionId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
