import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingService } from './coding.service.js';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { createIdempotencyOperationId } from '@/common/idempotency/index.js';
import type { CodingSessionHistoryDto, ExecuteCodingDto } from './dto/coding.dto.js';

type TMockPrismaModel = Record<string, ReturnType<typeof vi.fn>>;
type TMockPostgresClient = {
  codingQuestion: TMockPrismaModel;
  codingSession: TMockPrismaModel;
  codingAnswer: TMockPrismaModel;
  codingExecution: TMockPrismaModel;
  $transaction: ReturnType<typeof vi.fn>;
};

describe('CodingService', () => {
  let service: CodingService;
  let mongo: { user: { findUnique: ReturnType<typeof vi.fn> } };
  let postgres: {
    client_: Record<string, unknown>;
    withTenantContext: (userId: string, operation: (tx: unknown) => unknown) => Promise<unknown>;
  };
  let redis: {
    reserveQuota: ReturnType<typeof vi.fn>;
    reserveUniqueQuota: ReturnType<typeof vi.fn>;
    finalizeUniqueQuota: ReturnType<typeof vi.fn>;
  };
  let jobs: { enqueue: ReturnType<typeof vi.fn>; getJobId: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const userId = 'user_001';
  const problemId = '11111111-1111-4111-8111-111111111111';
  const secondProblemId = '22222222-2222-4222-8222-222222222222';
  const sessionId = '33333333-3333-4333-8333-333333333333';
  const examples = [{ input: [[2, 7], 9], output: [0, 1] }];
  const problem = {
    id: problemId,
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find two values that add to the target.',
    difficulty: 'Easy',
    topic: 'Arrays',
    examples,
    constraints: ['Two values exist.'],
    codeJs: 'function solution(nums, target) {}',
    codeTs: 'function solution(nums: number[], target: number): number[] {}',
    codePy: 'def solution(nums, target):\n    pass',
  };
  const session = {
    id: sessionId,
    userId,
    problemIds: [problemId],
    problemsAttempted: 0,
    problemsSolved: 0,
    status: 'in_progress',
    startedAt: new Date('2026-11-02T09:00:00Z'),
    completedAt: null,
    createdAt: new Date('2026-11-02T09:00:00Z'),
  };
  const answer = {
    id: '44444444-4444-4444-8444-444444444444',
    sessionId,
    userId,
    problemId,
    language: 'javascript',
    code: 'function solution(nums, target) { return [0, 1]; }',
    status: 'accepted',
    testCasesPassed: 1,
    testCasesTotal: 1,
    runtime: null,
    memoryUsage: null,
    createdAt: new Date('2026-11-02T09:10:00Z'),
  };
  const queuedExecution = {
    id: '55555555-5555-4555-8555-555555555555',
    sessionId,
    operation: 'run',
    status: 'queued',
    createdAt: new Date('2026-11-02T09:10:00Z'),
  };

  beforeEach(async () => {
    mongo = { user: { findUnique: vi.fn().mockResolvedValue({ role: 'USER' }) } };

    const codingSession = {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...session, ...data })
      ),
      findFirst: vi.fn().mockResolvedValue(session),
      findMany: vi.fn().mockResolvedValue([session]),
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const codingAnswer = {
      create: vi.fn().mockResolvedValue(answer),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([answer]),
      count: vi.fn().mockResolvedValue(1),
    };
    const codingExecution = {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...queuedExecution, ...data })
      ),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({ codingSession, codingAnswer, codingExecution })
    );
    postgres = {
      withTenantContext: vi.fn((_userId: string, callback: (tx: unknown) => unknown) =>
        transaction(callback)
      ),
      client_: {
        codingQuestion: {
          findMany: vi.fn().mockResolvedValue([problem]),
          findFirst: vi.fn().mockResolvedValue(problem),
          count: vi.fn().mockResolvedValue(1),
        },
        codingSession,
        codingAnswer,
        codingExecution,
        $transaction: transaction,
      },
    };

    redis = {
      reserveQuota: vi.fn().mockResolvedValue({ allowed: true, count: 1 }),
      reserveUniqueQuota: vi.fn().mockResolvedValue({ status: 'reserved', count: 1 }),
      finalizeUniqueQuota: vi.fn().mockResolvedValue(undefined),
    };
    jobs = {
      enqueue: vi.fn().mockResolvedValue('queue-job-id'),
      getJobId: vi.fn((queueName: string, id: string) => `${queueName}:${id}`),
    };
    config = {
      get: vi.fn((key: string) => {
        const values: Record<string, number> = {
          CODING_DAILY_SOLVED_FREE: 5,
          CODING_DAILY_SOLVED_PREMIUM: 999,
        };
        return values[key];
      }),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodingService,
        { provide: PrismaService, useValue: mongo },
        { provide: PrismaPostgresqlService, useValue: postgres },
        { provide: RedisService, useValue: redis },
        { provide: JobQueueService, useValue: jobs },
        { provide: ConfigService, useValue: config },
        { provide: 'PinoLogger:CodingService', useValue: logger },
      ],
    }).compile();

    service = module.get<CodingService>(CodingService);
  });

  const pg = () => postgres.client_ as unknown as TMockPostgresClient;

  describe('problem bank', () => {
    it('lists problems using only requested filters and does not expose test internals', async () => {
      const result = await service.listProblems({ topic: 'Arrays', difficulty: 'Easy' });

      expect(result).toEqual([expect.objectContaining({ id: problemId, slug: 'two-sum' })]);
      expect(pg().codingQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { topic: 'Arrays', difficulty: 'Easy' },
          select: expect.not.objectContaining({ testCases: true }),
        })
      );
    });

    it('loads a problem by its ID or slug and returns 404 when missing', async () => {
      await expect(service.getProblem('two-sum')).resolves.toEqual(problem);
      expect(pg().codingQuestion.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: 'two-sum' }, { slug: 'two-sum' }] },
      });

      pg().codingQuestion.findFirst.mockResolvedValueOnce(null);
      await expect(service.getProblem('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps database failures while loading a problem to 503', async () => {
      pg().codingQuestion.findFirst.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));

      await expect(service.getProblem('two-sum')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('returns 503 when PostgreSQL is unavailable', async () => {
      (postgres as { client_: unknown }).client_ = undefined;
      await expect(service.listProblems({})).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('maps PostgreSQL query errors to 503', async () => {
      pg().codingQuestion.findMany.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));

      await expect(service.listProblems({})).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('session start', () => {
    it('replays the original auto-selected assignment without querying problems again', async () => {
      const idempotencyKey = 'retry-session-start';
      const existing = {
        ...session,
        id: createIdempotencyOperationId(userId, 'coding-session', idempotencyKey),
      };
      pg().codingSession.findFirst.mockResolvedValueOnce(existing);

      await expect(service.startSession({}, userId, idempotencyKey)).resolves.toEqual(existing);

      expect(pg().codingQuestion.findMany).not.toHaveBeenCalled();
      expect(pg().codingSession.create).not.toHaveBeenCalled();
    });

    it('rejects reuse of a session key with a different problem selection', async () => {
      const idempotencyKey = 'retry-session-start';
      const existing = {
        ...session,
        id: createIdempotencyOperationId(userId, 'coding-session', idempotencyKey),
      };
      pg().codingSession.findFirst.mockResolvedValueOnce(existing);

      await expect(
        service.startSession({ problemIds: [secondProblemId] }, userId, idempotencyKey)
      ).rejects.toThrow('Idempotency-Key was already used with a different request');

      expect(pg().codingQuestion.findMany).not.toHaveBeenCalled();
      expect(pg().codingSession.create).not.toHaveBeenCalled();
    });

    it('replays an explicit problem selection independent of input ordering', async () => {
      const idempotencyKey = 'unordered-session-start';
      const existing = {
        ...session,
        id: createIdempotencyOperationId(userId, 'coding-session', idempotencyKey),
        problemIds: [problemId, secondProblemId],
      };
      pg().codingSession.findFirst.mockResolvedValueOnce(existing);

      await expect(
        service.startSession({ problemIds: [secondProblemId, problemId] }, userId, idempotencyKey)
      ).resolves.toEqual(existing);

      expect(pg().codingQuestion.findMany).not.toHaveBeenCalled();
    });

    it('replays the winning session when concurrent creation hits a unique constraint', async () => {
      const idempotencyKey = 'concurrent-session-start';
      const winner = {
        ...session,
        id: createIdempotencyOperationId(userId, 'coding-session', idempotencyKey),
      };
      pg().codingSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      pg().codingSession.create.mockRejectedValueOnce({ code: 'P2002' });

      await expect(
        service.startSession({ problemIds: [problemId] }, userId, idempotencyKey)
      ).resolves.toEqual(winner);

      expect(pg().codingSession.create).toHaveBeenCalledWith({
        data: {
          id: createIdempotencyOperationId(userId, 'coding-session', idempotencyKey),
          userId,
          problemIds: [problemId],
        },
      });
    });

    it('creates a session with selected problem IDs from the authenticated user', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.startSession({ problemIds: [problemId] }, userId, 'selected-session')
      ).resolves.toMatchObject({
        ...session,
        id: createIdempotencyOperationId(userId, 'coding-session', 'selected-session'),
      });

      expect(pg().codingQuestion.findMany).toHaveBeenCalledWith({
        where: { id: { in: [problemId] } },
        select: { id: true },
      });
      expect(pg().codingSession.create).toHaveBeenCalledWith({
        data: {
          id: createIdempotencyOperationId(userId, 'coding-session', 'selected-session'),
          userId,
          problemIds: [problemId],
        },
      });
    });

    it('rejects unknown selected problems without creating a session', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      pg().codingQuestion.findMany.mockResolvedValueOnce([]);
      await expect(
        service.startSession({ problemIds: [secondProblemId] }, userId, 'missing-problem')
      ).rejects.toThrow(NotFoundException);
      expect(pg().codingSession.create).not.toHaveBeenCalled();
    });

    it('chooses existing problems when the request omits problem IDs', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await service.startSession({}, userId, 'automatic-session');
      expect(pg().codingSession.create).toHaveBeenCalledWith({
        data: {
          id: createIdempotencyOperationId(userId, 'coding-session', 'automatic-session'),
          userId,
          problemIds: [problemId],
        },
      });
    });

    it('returns 404 when there are no coding problems to start with', async () => {
      pg().codingQuestion.findMany.mockResolvedValueOnce([]);

      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.startSession({}, userId, 'empty-session')).rejects.toThrow(
        'No coding problems are available'
      );
      expect(pg().codingSession.create).not.toHaveBeenCalled();
    });

    it('fails with 503 when PostgreSQL is unavailable', async () => {
      (postgres as { client_: unknown }).client_ = undefined;
      await expect(service.startSession({}, userId, 'missing-database')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('maps selected-problem query errors to 503', async () => {
      pg().codingQuestion.findMany.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));
      pg().codingSession.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.startSession({ problemIds: [problemId] }, userId, 'query-failure')
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('run code', () => {
    const dto = {
      problemId,
      language: 'javascript',
      code: 'function solution() { return [0, 1]; }',
    } satisfies ExecuteCodingDto;

    it('persists the execution before enqueueing and returns its durable queued status', async () => {
      jobs.enqueue.mockResolvedValueOnce('queue-job-id');

      await expect(service.runCode(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ ...queuedExecution, id: expect.any(String) })
      );

      expect(pg().codingExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId,
          userId,
          problemId,
          operation: 'run',
          language: dto.language,
          status: 'queued',
          sourceCode: dto.code,
          examples,
          queueJobId: expect.stringMatching(/^coding-execution-queue:[0-9a-f-]{36}$/),
        }),
      });
      expect(jobs.enqueue).toHaveBeenCalledWith(
        JOB_QUEUE_NAMES.CODING_EXECUTION,
        expect.objectContaining({
          executionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          operation: 'run',
          sessionId,
          userId,
        }),
        'execute'
      );
    });

    it('persists a queued run for the session owner without consuming solve quota', async () => {
      await expect(service.runCode(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ ...queuedExecution, id: expect.any(String) })
      );

      expect(redis.reserveQuota).toHaveBeenCalledWith(`coding-execution:${userId}`, 10, 60);

      expect(pg().codingSession.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId, userId },
      });
      expect(jobs.enqueue).toHaveBeenCalledWith(
        JOB_QUEUE_NAMES.CODING_EXECUTION,
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
          code: dto.code,
          language: dto.language,
          examples,
        }),
        'execute'
      );
      expect(pg().codingAnswer.create).not.toHaveBeenCalled();
      expect(pg().codingExecution.create).toHaveBeenCalledOnce();
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
    });

    it('requires an idempotency key before loading or queueing a run', async () => {
      await expect(service.runCode(sessionId, userId, dto, '')).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(pg().codingExecution.create).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('replays a matching durable run without reserving capacity or enqueueing again', async () => {
      const { createIdempotencyOperationId } = await import('@/common/idempotency/index.js');
      const executionId = createIdempotencyOperationId(userId, 'coding-execution', 'request_001');
      const persisted = {
        ...queuedExecution,
        id: executionId,
        problemId,
        operation: 'run',
        language: dto.language,
        sourceCode: dto.code,
      };
      pg().codingExecution.findFirst.mockResolvedValueOnce(persisted);

      await expect(service.runCode(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ id: executionId, operation: 'run' })
      );

      expect(redis.reserveQuota).not.toHaveBeenCalled();
      expect(pg().codingExecution.create).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a run replay when the key is reused for different code', async () => {
      pg().codingExecution.findFirst.mockResolvedValueOnce({
        ...queuedExecution,
        problemId,
        operation: 'run',
        language: dto.language,
        sourceCode: 'different code',
      });

      await expect(service.runCode(sessionId, userId, dto, 'request_001')).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(redis.reserveQuota).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('replays a matching run created by a concurrent request after a unique-key race', async () => {
      const { createIdempotencyOperationId } = await import('@/common/idempotency/index.js');
      const executionId = createIdempotencyOperationId(userId, 'coding-execution', 'request_001');
      const persisted = {
        ...queuedExecution,
        id: executionId,
        problemId,
        operation: 'run',
        language: dto.language,
        sourceCode: dto.code,
      };
      pg().codingExecution.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(persisted);
      pg().codingExecution.create.mockRejectedValueOnce({ code: 'P2002' });

      await expect(service.runCode(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ id: executionId })
      );
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a key reused for the same actor in a different session', async () => {
      const otherSessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      pg().codingSession.findFirst.mockResolvedValueOnce({
        ...session,
        id: otherSessionId,
        problemIds: [],
      });
      pg().codingExecution.findFirst.mockResolvedValueOnce({
        ...queuedExecution,
        sessionId,
        problemId,
        operation: 'run',
        language: dto.language,
        sourceCode: dto.code,
      });

      await expect(
        service.runCode(otherSessionId, userId, dto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
      expect(redis.reserveQuota).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a key reused for a different problem before checking problem assignment', async () => {
      pg().codingExecution.findFirst.mockResolvedValueOnce({
        ...queuedExecution,
        sessionId,
        problemId,
        operation: 'run',
        language: dto.language,
        sourceCode: dto.code,
      });
      const changedDto = { ...dto, problemId: secondProblemId };

      await expect(
        service.runCode(sessionId, userId, changedDto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
      expect(pg().codingQuestion.findFirst).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns 404 for another user’s session without running Piston', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.runCode(sessionId, 'other_user', dto, 'request_001')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns 404 if the problem is not assigned to the session', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce({
        ...session,
        problemIds: [secondProblemId],
      });
      await expect(service.runCode(sessionId, userId, dto, 'request_001')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a completed session before calling Piston', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce({ ...session, status: 'completed' });
      await expect(service.runCode(sessionId, userId, dto, 'request_001')).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rejects execution over the per-user rate limit before calling Piston', async () => {
      redis.reserveQuota.mockResolvedValueOnce({ allowed: false, count: 10 });

      await expect(service.runCode(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'Code execution rate limit exceeded'
      );
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when Redis cannot reserve execution capacity', async () => {
      redis.reserveQuota.mockRejectedValueOnce(new Error('redis down'));

      await expect(service.runCode(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'Code execution rate limiter is temporarily unavailable'
      );
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('submit solution', () => {
    const dto = {
      problemId,
      language: 'javascript',
      code: 'function solution() { return [0, 1]; }',
    } satisfies ExecuteCodingDto;

    it('persists a queued submission and passes the reserved solve slot to the worker', async () => {
      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ ...queuedExecution, id: expect.any(String), operation: 'submit' })
      );

      expect(redis.reserveUniqueQuota).toHaveBeenCalledWith(
        expect.stringMatching(/^coding-solved:user_001:\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^coding-problem:user_001:/),
        5,
        expect.any(Number),
        expect.any(String)
      );
      expect(redis.reserveQuota).toHaveBeenCalledWith(`coding-execution:${userId}`, 10, 60);
      expect(pg().$transaction).toHaveBeenCalledTimes(3);
      expect(jobs.enqueue).toHaveBeenCalledWith(
        JOB_QUEUE_NAMES.CODING_EXECUTION,
        expect.objectContaining({
          operation: 'submit',
          quotaReservation: {
            quotaKey: expect.stringMatching(/^coding-solved:user_001:/),
            itemKey: `coding-problem:${userId}:${problemId}`,
            ttlSeconds: expect.any(Number),
            reservationToken: expect.any(String),
          },
        }),
        'execute'
      );
      expect(redis.finalizeUniqueQuota).not.toHaveBeenCalled();
    });

    it('replays a matching durable submission before checking or reserving quota', async () => {
      const { createIdempotencyOperationId } = await import('@/common/idempotency/index.js');
      const executionId = createIdempotencyOperationId(userId, 'coding-execution', 'request_001');
      const persisted = {
        ...queuedExecution,
        id: executionId,
        problemId,
        operation: 'submit',
        language: dto.language,
        sourceCode: dto.code,
      };
      pg().codingExecution.findFirst.mockResolvedValueOnce(persisted);

      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ id: executionId, operation: 'submit' })
      );

      expect(redis.reserveQuota).not.toHaveBeenCalled();
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
      expect(pg().codingExecution.create).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('leaves completed outcome handling and answer creation to the worker', async () => {
      await service.submitSolution(sessionId, userId, dto, 'request_001');

      expect(redis.finalizeUniqueQuota).not.toHaveBeenCalled();
      expect(pg().codingAnswer.create).not.toHaveBeenCalled();
      expect(pg().codingExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'queued', operation: 'submit' }),
      });
    });

    it('does not call Piston when the solve limit is reached', async () => {
      redis.reserveUniqueQuota.mockResolvedValueOnce({ status: 'limit', count: 5 });
      await expect(
        service.submitSolution(sessionId, userId, dto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
      expect(jobs.enqueue).not.toHaveBeenCalled();
      expect(pg().codingAnswer.create).not.toHaveBeenCalled();
    });

    it('rejects submit over the execution rate limit before Piston and daily solve reservation', async () => {
      redis.reserveQuota.mockResolvedValueOnce({ allowed: false, count: 10 });

      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'Code execution rate limit exceeded'
      );
      expect(jobs.enqueue).not.toHaveBeenCalled();
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
    });

    it('does not call Piston when this same problem is being submitted concurrently', async () => {
      redis.reserveUniqueQuota.mockResolvedValueOnce({ status: 'in_progress', count: 1 });
      await expect(
        service.submitSolution(sessionId, userId, dto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rechecks durable execution when a same-key submit reservation is already in progress', async () => {
      const { createIdempotencyOperationId } = await import('@/common/idempotency/index.js');
      const executionId = createIdempotencyOperationId(userId, 'coding-execution', 'request_001');
      const persisted = {
        ...queuedExecution,
        id: executionId,
        problemId,
        operation: 'submit',
        language: dto.language,
        sourceCode: dto.code,
      };
      pg().codingExecution.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(persisted);
      redis.reserveUniqueQuota.mockResolvedValueOnce({ status: 'in_progress', count: 1 });

      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ id: executionId, operation: 'submit' })
      );
      expect(pg().codingExecution.create).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns 404 when the authenticated user record is missing', async () => {
      mongo.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'User not found'
      );
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns 503 when the solve quota service is unavailable', async () => {
      redis.reserveUniqueQuota.mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(
        service.submitSolution(sessionId, userId, dto, 'request_001')
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('saves a previously solved problem without reserving another daily solve slot', async () => {
      redis.reserveUniqueQuota.mockResolvedValueOnce({ status: 'already_solved', count: 1 });
      await service.submitSolution(sessionId, userId, dto, 'request_001');
      expect(jobs.enqueue).toHaveBeenCalledOnce();
      expect(redis.finalizeUniqueQuota).not.toHaveBeenCalled();
    });

    it('releases the slot when Piston fails', async () => {
      jobs.enqueue.mockRejectedValueOnce(new ServiceUnavailableException());
      await expect(
        service.submitSolution(sessionId, userId, dto, 'request_001')
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(redis.finalizeUniqueQuota).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'release',
        expect.any(Number),
        expect.any(String)
      );
      expect(pg().codingAnswer.create).not.toHaveBeenCalled();
    });

    it('preserves the execution error and logs a failed reservation release', async () => {
      jobs.enqueue.mockRejectedValueOnce(new ServiceUnavailableException('worker unavailable'));
      redis.finalizeUniqueQuota.mockRejectedValueOnce(new Error('Redis unavailable'));

      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'worker unavailable'
      );
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to release a coding solve reservation'
      );
    });

    it('releases the slot when durable execution creation fails', async () => {
      pg().codingExecution.create.mockRejectedValueOnce(new Error('database write failed'));
      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'Coding database is temporarily unavailable'
      );
      expect(redis.finalizeUniqueQuota).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'release',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('allows resubmission for an already solved problem without reserving solve quota', async () => {
      redis.reserveUniqueQuota.mockResolvedValueOnce({ status: 'already_solved', count: 1 });
      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ ...queuedExecution, id: expect.any(String), operation: 'submit' })
      );
      expect(jobs.enqueue).toHaveBeenCalledOnce();
      expect(jobs.enqueue.mock.calls[0][1]).toEqual(
        expect.objectContaining({ quotaReservation: null })
      );
    });

    it('leaves session completion race handling to the transactional worker', async () => {
      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).resolves.toEqual(
        expect.objectContaining({ ...queuedExecution, id: expect.any(String), operation: 'submit' })
      );
      expect(pg().codingSession.updateMany).not.toHaveBeenCalled();
      expect(pg().codingAnswer.create).not.toHaveBeenCalled();
    });

    it('returns 404 for a session not owned by the caller', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.submitSolution(sessionId, 'other_user', dto, 'request_001')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns 404 for a problem outside the session', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce({
        ...session,
        problemIds: [secondProblemId],
      });
      await expect(
        service.submitSolution(sessionId, userId, dto, 'request_001')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns 404 when an assigned coding problem no longer exists', async () => {
      pg().codingQuestion.findFirst.mockResolvedValueOnce(null);

      await expect(service.submitSolution(sessionId, userId, dto, 'request_001')).rejects.toThrow(
        'Coding problem not found'
      );
      expect(redis.reserveUniqueQuota).not.toHaveBeenCalled();
    });
  });

  describe('session retrieval and lifecycle', () => {
    it('gets an execution by session and authenticated user scope', async () => {
      const detailedExecution = { ...queuedExecution, answer: null };
      pg().codingExecution.findFirst.mockResolvedValueOnce(detailedExecution);

      await expect(service.getExecution(sessionId, detailedExecution.id, userId)).resolves.toEqual(
        detailedExecution
      );
      expect(pg().codingExecution.findFirst).toHaveBeenCalledWith({
        where: { id: detailedExecution.id, sessionId, userId },
        select: expect.objectContaining({ id: true, status: true, result: true, answer: true }),
      });
    });

    it('returns 404 for a missing or foreign execution', async () => {
      pg().codingExecution.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getExecution(sessionId, queuedExecution.id, 'other_user')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('gets a session with its answers scoped to the authenticated user', async () => {
      const sessionWithAnswers = { ...session, answers: [answer] };
      pg().codingSession.findFirst.mockResolvedValueOnce(sessionWithAnswers);
      await expect(service.getSessionDetail(sessionId, userId)).resolves.toEqual(
        sessionWithAnswers
      );
      expect(pg().codingSession.findFirst).toHaveBeenCalledWith({
        where: { id: sessionId, userId },
        include: { answers: { orderBy: { createdAt: 'asc' } } },
      });
    });

    it('maps database errors while loading session detail to 503', async () => {
      pg().codingSession.findFirst.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));

      await expect(service.getSessionDetail(sessionId, userId)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });

    it('returns 404 when the requested session belongs to another user', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.getSessionDetail(sessionId, 'other_user')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('completes only an owned in-progress session', async () => {
      await expect(service.completeSession(sessionId, userId)).resolves.toEqual(
        expect.objectContaining({ status: 'completed' })
      );
      expect(pg().codingSession.updateMany).toHaveBeenCalledWith({
        where: { id: sessionId, userId, status: 'in_progress' },
        data: { status: 'completed', completedAt: expect.any(Date) },
      });
    });

    it('returns 404 when a session cannot be completed by the caller', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.completeSession(sessionId, 'other_user')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    it('replays a completed session without applying the transition twice', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce({ ...session, status: 'completed' });
      await expect(service.completeSession(sessionId, userId)).resolves.toMatchObject({
        status: 'completed',
      });
      expect(pg().codingSession.updateMany).not.toHaveBeenCalled();
    });

    it('replays a completion that wins a concurrent status update', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(session);
      pg().codingSession.findFirst.mockResolvedValueOnce({ ...session, status: 'completed' });
      pg().codingSession.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.completeSession(sessionId, userId)).resolves.toMatchObject({
        status: 'completed',
      });
    });

    it('retains a conflict when a lost completion update did not complete the session', async () => {
      pg().codingSession.findFirst.mockResolvedValueOnce(session).mockResolvedValueOnce(session);
      pg().codingSession.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.completeSession(sessionId, userId)).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it('lists only the caller’s sessions with validated pagination', async () => {
      await expect(service.getSessionHistory(userId, { page: 2, limit: 10 })).resolves.toEqual({
        sessions: [session],
        total: 1,
        page: 2,
        limit: 10,
      });
      expect(pg().codingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId }, skip: 10, take: 10 })
      );
      expect(pg().codingSession.count).toHaveBeenCalledWith({ where: { userId } });
    });

    it('maps history query failures to 503', async () => {
      pg().codingSession.count.mockRejectedValueOnce(new Error('PostgreSQL unavailable'));

      await expect(
        service.getSessionHistory(userId, { page: 1, limit: 20 })
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('uses default pagination when values are omitted', async () => {
      await expect(
        service.getSessionHistory(userId, {} as CodingSessionHistoryDto)
      ).resolves.toEqual({
        sessions: [session],
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(pg().codingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId }, skip: 0, take: 20 })
      );
    });
  });
});
