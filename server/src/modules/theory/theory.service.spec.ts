import { Test, TestingModule } from '@nestjs/testing';
import { TheoryService } from './theory.service.js';
import { StartSessionDto } from './dto/start-session.dto.js';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { createTheoryAnswerId } from './theory-idempotency.js';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {} from '@/common/index.js';

describe('TheoryService', () => {
  afterEach(() => vi.unstubAllEnvs());
  let service: TheoryService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    pdfSource: { findMany: ReturnType<typeof vi.fn> };
    topic: { findUnique: ReturnType<typeof vi.fn> };
    question: { findMany: ReturnType<typeof vi.fn> };
  };
  let postgres: {
    withTenantContext: (userId: string, operation: (tx: unknown) => unknown) => Promise<unknown>;
    client_: {
      theorySession: {
        count: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
      theoryAnswer: {
        create: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
      $transaction: (operation: (tx: unknown) => unknown) => Promise<unknown>;
    };
  };
  let redis: {
    reserveQuota: ReturnType<typeof vi.fn>;
    releaseQuota: ReturnType<typeof vi.fn>;
  };
  let jobs: { enqueue: ReturnType<typeof vi.fn>; getJobId: ReturnType<typeof vi.fn> };
  let config: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockPinoLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockUser = { role: 'USER' };
  const mockPremiumUser = { role: 'PREMIUM' };
  const mockTopic = { id: 'topic_001', name: 'React', slug: 'react' };

  const mockSession = {
    id: 'session_001',
    userId: 'user_001',
    topicId: 'topic_001',
    mode: 'topic',
    difficulty: 'Mid',
    totalQuestions: 10,
    questionsAnswered: 0,
    avgScore: 0,
    status: 'in_progress',
    startedAt: new Date('2026-07-25T10:30:00Z'),
    completedAt: null,
    createdAt: new Date('2026-07-25T10:30:00Z'),
  };

  const mockCompletedSession = {
    ...mockSession,
    status: 'completed',
    questionsAnswered: 10,
    avgScore: 7.5,
    completedAt: new Date('2026-07-25T11:00:00Z'),
  };

  const mockQuestions = [
    {
      id: 'q_001',
      question: 'What is React?',
      topicId: 'topic_001',
      difficulty: 'Mid',
      referenceAnswer: 'A library for UI',
    },
    {
      id: 'q_002',
      question: 'What is JSX?',
      topicId: 'topic_001',
      difficulty: 'Mid',
      referenceAnswer: 'Syntax extension',
    },
  ];

  const mockAnswer = {
    id: 'answer_001',
    sessionId: 'session_001',
    questionId: 'q_001',
    questionText: 'What is React?',
    userAnswer: 'React is a UI library',
    aiScore: 8.5,
    aiFeedback: 'Good answer.',
    timeTaken: 120,
    createdAt: new Date('2026-07-25T10:32:00Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn() },
      pdfSource: { findMany: vi.fn() },
      topic: { findUnique: vi.fn() },
      question: { findMany: vi.fn() },
    };

    postgres = {
      withTenantContext: vi.fn((_userId: string, operation: (tx: unknown) => unknown) =>
        postgres.client_.$transaction(operation)
      ),
      client_: {
        theorySession: {
          count: vi.fn(),
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        theoryAnswer: {
          create: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          updateMany: vi.fn(),
        },
        $transaction: vi.fn(async (operation: (tx: unknown) => unknown) =>
          operation(postgres.client_)
        ),
      },
    };
    config = {
      get: vi.fn(),
    };
    redis = {
      reserveQuota: vi.fn().mockResolvedValue({ allowed: true, count: 1 }),
      releaseQuota: vi.fn().mockResolvedValue(undefined),
    };
    jobs = {
      enqueue: vi.fn().mockResolvedValue('job_001'),
      getJobId: vi.fn().mockReturnValue('job_001'),
    };

    mockPinoLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    vi.clearAllMocks();
    const scopedClient = postgres.client_;
    (scopedClient.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (operation: (tx: unknown) => unknown) => operation(scopedClient)
    );
    (postgres.withTenantContext as ReturnType<typeof vi.fn>).mockImplementation(
      (_userId: string, operation: (tx: unknown) => unknown) => scopedClient.$transaction(operation)
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TheoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaPostgresqlService, useValue: postgres },
        { provide: RedisService, useValue: redis },
        { provide: JobQueueService, useValue: jobs },
        { provide: ConfigService, useValue: config },
        { provide: 'PinoLogger:TheoryService', useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<TheoryService>(TheoryService);
  });

  it.each([
    ['getSessionQuestions', () => service.getSessionQuestions('session_001', 'user_001', {})],
    [
      'submitAnswer',
      () =>
        service.submitAnswer(
          'session_001',
          'user_001',
          {
            questionText: 'Question',
            userAnswer: 'Answer',
          },
          'idempotency_001'
        ),
    ],
    ['completeSession', () => service.completeSession('session_001', 'user_001')],
    ['getSessionDetail', () => service.getSessionDetail('session_001', 'user_001')],
    ['getSessionHistory', () => service.getSessionHistory('user_001', {})],
    ['getWeakAreas', () => service.getWeakAreas('user_001')],
    ['getScoreTrend', () => service.getScoreTrend('user_001', {})],
  ])('returns 503 when PostgreSQL is unavailable for %s', async (_method, invoke) => {
    Object.defineProperty(postgres, 'client_', { configurable: true, value: undefined });

    await expect(invoke()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  describe('startSession', () => {
    const dto: StartSessionDto = {
      topicId: 'topic_001',
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: 10,
    };

    it('should create a session successfully for free user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      postgres.client_.theorySession.create.mockResolvedValue(mockSession);

      const result = await service.startSession(dto, 'user_001');

      expect(result).toEqual(mockSession);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkUserId: 'user_001' },
        select: { role: true },
      });
      expect(redis.reserveQuota).toHaveBeenCalledWith(
        expect.stringMatching(/^quota:user_001:\d{4}-\d{2}-\d{2}:theory_sessions$/),
        3,
        expect.any(Number)
      );
      expect(postgres.client_.theorySession.count).not.toHaveBeenCalled();
      expect(postgres.client_.theorySession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user_001' }),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.startSession(dto, 'unknown_user')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if totalQuestions exceeds limit', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });

      const overLimitDto = { ...dto, totalQuestions: 15 };

      await expect(service.startSession(overLimitDto, 'user_001')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw ForbiddenException if daily limit reached', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      redis.reserveQuota.mockResolvedValue({ allowed: false, count: 3 });
      prisma.topic.findUnique.mockResolvedValue(mockTopic);

      await expect(service.startSession(dto, 'user_001')).rejects.toThrow(ForbiddenException);
      expect(postgres.client_.theorySession.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if topic not found in topic mode', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      redis.reserveQuota.mockRejectedValue(new Error('Redis unavailable'));
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      postgres.client_.theorySession.count.mockResolvedValue(0);
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.startSession(dto, 'user_001')).rejects.toThrow(NotFoundException);
    });

    it('should allow premium user 30 questions per session', async () => {
      prisma.user.findUnique.mockResolvedValue(mockPremiumUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_PREMIUM: 999,
          THEORY_QUESTIONS_PER_SESSION_PREMIUM: 30,
        };
        return values[key];
      });
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      postgres.client_.theorySession.create.mockResolvedValue(mockSession);

      const premiumDto = { ...dto, totalQuestions: 25 };

      const result = await service.startSession(premiumDto, 'user_premium');

      expect(result).toEqual(mockSession);
    });

    it('should skip topic validation for weak mode', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      postgres.client_.theorySession.create.mockResolvedValue({
        ...mockSession,
        mode: 'weak',
        topicId: null,
      });

      const weakDto: StartSessionDto = { mode: 'weak', difficulty: 'Mid', totalQuestions: 10 };

      const result = await service.startSession(weakDto, 'user_001');

      expect(result.mode).toBe('weak');
      expect(prisma.topic.findUnique).not.toHaveBeenCalled();
    });

    it('should require a topic id for topic mode', async () => {
      await expect(
        service.startSession({ mode: 'topic', difficulty: 'Mid', totalQuestions: 10 }, 'user_001')
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should persist selected ready PDF revisions and enqueue generation by session ID', async () => {
      const pdfId = '507f1f77bcf86cd799439011';
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.pdfSource.findMany.mockResolvedValue([{ id: pdfId, activeRevision: 3 }]);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      const pdfSession = {
        ...mockSession,
        mode: 'pdf',
        topicId: null,
        pdfGenerationStatus: 'queued',
      };
      postgres.client_.theorySession.create.mockResolvedValue(pdfSession);

      const result = await service.startSession(
        { mode: 'pdf', pdfIds: [pdfId], difficulty: 'Mid', totalQuestions: 10 },
        'user_001'
      );

      expect(result).toEqual(pdfSession);
      expect(prisma.pdfSource.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [pdfId] },
          userId: 'user_001',
          status: { in: ['ready', 'processing'] },
          activeRevision: { gt: 0 },
        },
        select: { id: true, activeRevision: true },
      });
      expect(postgres.client_.theorySession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mode: 'pdf',
          pdfIds: [pdfId],
          pdfRevisions: { [pdfId]: 3 },
        }),
      });
      expect(jobs.enqueue).toHaveBeenCalledWith(
        'pdf-question-generation-queue',
        { idempotencyKey: 'pdf-study:session_001', sessionId: 'session_001' },
        'generate'
      );
    });

    it('should fail closed when Redis quota is unavailable', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      redis.reserveQuota.mockRejectedValue(new Error('Redis unavailable'));
      prisma.topic.findUnique.mockResolvedValue(mockTopic);

      await expect(service.startSession(dto, 'user_001')).rejects.toThrow(
        ServiceUnavailableException
      );
      expect(postgres.client_.theorySession.count).not.toHaveBeenCalled();
      expect(postgres.client_.theorySession.create).not.toHaveBeenCalled();
    });

    it('releases the quota when PostgreSQL session creation fails', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      const databaseError = new Error('PostgreSQL unavailable');
      postgres.client_.theorySession.create.mockRejectedValueOnce(databaseError);

      await expect(service.startSession(dto, 'user_001')).rejects.toBe(databaseError);
      expect(redis.releaseQuota).toHaveBeenCalledOnce();
    });

    it('logs quota cleanup failures without hiding the session creation error', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      config.get.mockImplementation((key: string) => {
        const values: Record<string, number> = {
          THEORY_DAILY_SESSIONS_FREE: 3,
          THEORY_QUESTIONS_PER_SESSION_FREE: 10,
        };
        return values[key];
      });
      prisma.topic.findUnique.mockResolvedValue(mockTopic);
      const databaseError = new Error('PostgreSQL unavailable');
      postgres.client_.theorySession.create.mockRejectedValueOnce(databaseError);
      redis.releaseQuota.mockRejectedValueOnce('Redis unavailable');

      await expect(service.startSession(dto, 'user_001')).rejects.toBe(databaseError);
      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        { error: 'Redis unavailable' },
        'Could not release reserved theory session quota'
      );
    });
  });

  describe('getSessionQuestions', () => {
    const dto = {};

    it('should fetch questions for topic mode', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      prisma.question.findMany.mockResolvedValue(mockQuestions);

      const result = await service.getSessionQuestions('session_001', 'user_001', dto);

      expect(result).toEqual(mockQuestions);
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'user_001' },
      });
      expect(prisma.question.findMany).toHaveBeenCalledWith({
        where: { topicId: 'topic_001', difficulty: 'Mid' },
        take: 10,
        select: expect.any(Object),
      });
      expect(prisma.question.findMany.mock.calls[0][0].select).not.toHaveProperty(
        'referenceAnswer'
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(service.getSessionQuestions('bad_id', 'user_001', dto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should hide another users session with NotFoundException', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(service.getSessionQuestions('session_001', 'other_user', dto)).rejects.toThrow(
        NotFoundException
      );
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'other_user' },
      });
    });

    it('should use limit from query param when provided', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      prisma.question.findMany.mockResolvedValue(mockQuestions);

      await service.getSessionQuestions('session_001', 'user_001', { limit: 5 });

      expect(prisma.question.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });

    it('should fetch questions for weak mode', async () => {
      const weakSession = { ...mockSession, mode: 'weak', topicId: null };
      postgres.client_.theorySession.findFirst.mockResolvedValue(weakSession);
      postgres.client_.theorySession.findMany.mockResolvedValue([]);
      prisma.question.findMany.mockResolvedValue(mockQuestions);

      const result = await service.getSessionQuestions('session_001', 'user_001', dto);

      expect(result).toEqual(mockQuestions);
      expect(prisma.question.findMany).toHaveBeenCalledWith({
        where: { difficulty: 'Mid' },
        take: 10,
        select: expect.any(Object),
      });
      expect(prisma.question.findMany.mock.calls[0][0].select).not.toHaveProperty(
        'referenceAnswer'
      );
    });

    it('should reject PDF sessions rather than fetching unrelated questions', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        mode: 'pdf',
        pdfGenerationStatus: 'queued',
      });

      await expect(service.getSessionQuestions('session_001', 'user_001', dto)).rejects.toThrow(
        ConflictException
      );
      expect(prisma.question.findMany).not.toHaveBeenCalled();
    });

    it('requires the topic reference on a topic session', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        topicId: null,
      });

      await expect(service.getSessionQuestions('session_001', 'user_001', dto)).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.question.findMany).not.toHaveBeenCalled();
    });

    it('uses weak topics when prior weak scores are available', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        mode: 'weak',
        topicId: null,
      });
      postgres.client_.theorySession.findMany.mockResolvedValue([
        { topicId: 'topic_001', avgScore: 5 },
      ]);
      prisma.question.findMany.mockResolvedValue(mockQuestions);

      await service.getSessionQuestions('session_001', 'user_001', dto);

      expect(prisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { topicId: { in: ['topic_001'] }, difficulty: 'Mid' } })
      );
    });

    it('continues without a topic filter if the client disappears while loading weak topics', async () => {
      const client = postgres.client_;
      client.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        mode: 'weak',
        topicId: null,
      });
      Object.defineProperty(postgres, 'client_', {
        configurable: true,
        get: vi.fn().mockReturnValueOnce(client).mockReturnValueOnce(undefined),
      });
      prisma.question.findMany.mockResolvedValue(mockQuestions);

      await service.getSessionQuestions('session_001', 'user_001', dto);

      expect(prisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { difficulty: 'Mid' } })
      );
    });
  });

  describe('submitAnswer', () => {
    const dto = {
      questionId: 'q_001',
      questionText: 'What is React?',
      userAnswer: 'React is a UI library',
      timeTaken: 120,
    };

    const queuedAnswer = {
      ...mockAnswer,
      aiScore: null,
      aiFeedback: null,
      status: 'queued',
      id: createTheoryAnswerId('session_001', 'request_001'),
    };

    it('persists a queued answer and returns without calling the evaluator', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.create.mockResolvedValue(queuedAnswer);

      const result = await service.submitAnswer('session_001', 'user_001', dto, 'request_001');

      expect(result).toEqual(queuedAnswer);
      expect(postgres.client_.$transaction).toHaveBeenCalledTimes(2);
      expect(postgres.client_.theoryAnswer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: createTheoryAnswerId('session_001', 'request_001'),
          status: 'queued',
          aiScore: null,
          aiFeedback: null,
          questionId: 'q_001',
          timeTaken: 120,
        }),
      });
      expect(jobs.enqueue).toHaveBeenCalledWith(
        'theory-eval-queue',
        { idempotencyKey: queuedAnswer.id, answerId: queuedAnswer.id },
        'evaluate'
      );
    });

    it('returns an existing answer when the same request is replayed', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.findFirst.mockResolvedValue(queuedAnswer);

      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'request_001')
      ).resolves.toEqual(queuedAnswer);

      expect(postgres.client_.$transaction).toHaveBeenCalledOnce();
      expect(jobs.enqueue).not.toHaveBeenCalled();
      expect(postgres.client_.theoryAnswer.findFirst).toHaveBeenCalledWith({
        where: {
          id: createTheoryAnswerId('session_001', 'request_001'),
          sessionId: 'session_001',
        },
      });
    });

    it('rejects a replay when the idempotency key is reused for a different request', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.findFirst.mockResolvedValue(queuedAnswer);
      const changedDto = { ...dto, userAnswer: 'A different answer' };

      await expect(
        service.submitAnswer('session_001', 'user_001', changedDto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);

      expect(postgres.client_.$transaction).toHaveBeenCalledOnce();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('treats omitted optional fields as equivalent to their persisted null values', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      const persistedAnswer = { ...queuedAnswer, questionId: null, timeTaken: null };
      postgres.client_.theoryAnswer.findFirst.mockResolvedValue(persistedAnswer);
      const minimalDto = {
        questionText: dto.questionText,
        userAnswer: dto.userAnswer,
      };

      await expect(
        service.submitAnswer('session_001', 'user_001', minimalDto, 'request_001')
      ).resolves.toEqual(persistedAnswer);
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('returns the row another concurrent request created with the same key', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(queuedAnswer);
      const tx = postgres.client_.$transaction as ReturnType<typeof vi.fn>;
      tx.mockImplementationOnce(async (operation: (client: unknown) => unknown) =>
        operation(postgres.client_)
      );
      tx.mockRejectedValueOnce({ code: 'P2002' });
      tx.mockImplementationOnce(async (operation: (client: unknown) => unknown) =>
        operation(postgres.client_)
      );

      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'request_001')
      ).resolves.toEqual(queuedAnswer);
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a missing idempotency key', async () => {
      await expect(service.submitAnswer('session_001', 'user_001', dto, '')).rejects.toBeInstanceOf(
        BadRequestException
      );
    });

    it('rejects an idempotency key longer than the supported bound', async () => {
      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'x'.repeat(129))
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hides another users session with NotFoundException', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(
        service.submitAnswer('session_001', 'other_user', dto, 'request_001')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'other_user' },
      });
    });

    it('rejects answers after the session is completed', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockCompletedSession);

      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns the queued answer when queue submission fails so the worker can redispatch it', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.create.mockResolvedValue(queuedAnswer);
      jobs.enqueue.mockRejectedValue(new ServiceUnavailableException());

      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'request_001')
      ).resolves.toEqual(queuedAnswer);
      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ answerId: queuedAnswer.id }),
        'Theory answer persisted; worker will redispatch the queued evaluation'
      );
    });

    it('rejects submissions when the session has no remaining question slots', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        questionsAnswered: mockSession.totalQuestions,
      });

      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
      expect(postgres.client_.theoryAnswer.create).not.toHaveBeenCalled();
    });

    it('rejects when another submission consumes the last slot during the transaction', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theorySession.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.submitAnswer('session_001', 'user_001', dto, 'request_001')
      ).rejects.toBeInstanceOf(ConflictException);
      expect(postgres.client_.theoryAnswer.create).not.toHaveBeenCalled();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });
  });
  describe('completeSession', () => {
    it('should complete session with avg score', async () => {
      const sessionWithAnswers = {
        ...mockSession,
        questionsAnswered: 2,
        answers: [{ aiScore: 8 }, { aiScore: 9 }],
      };
      const completed = {
        ...mockSession,
        status: 'completed',
        avgScore: 8.5,
        completedAt: new Date(),
      };
      postgres.client_.theorySession.findFirst
        .mockResolvedValueOnce(sessionWithAnswers)
        .mockResolvedValueOnce(completed);

      const result = await service.completeSession('session_001', 'user_001');

      expect(result.status).toBe('completed');
      expect(result.avgScore).toBe(8.5);
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'user_001' },
        include: { answers: true },
      });
      expect(postgres.client_.theorySession.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'session_001',
          userId: 'user_001',
          status: 'in_progress',
          questionsAnswered: 2,
        },
        data: expect.objectContaining({ status: 'completed', avgScore: 8.5 }),
      });
    });

    it('should reject completion while an answer slot is still being processed', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        questionsAnswered: 1,
        answers: [],
      });
      postgres.client_.theorySession.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeSession('session_001', 'user_001')).rejects.toThrow(
        ConflictException
      );
      expect(postgres.client_.theorySession.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ questionsAnswered: 0, status: 'in_progress' }),
        data: expect.any(Object),
      });
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledTimes(1);
    });

    it('rejects completion while a persisted answer is still queued or running', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue({
        ...mockSession,
        questionsAnswered: 1,
        answers: [{ status: 'running', aiScore: null }],
      });

      await expect(service.completeSession('session_001', 'user_001')).rejects.toThrow(
        ConflictException
      );
      expect(postgres.client_.theorySession.updateMany).not.toHaveBeenCalled();
    });

    it('computes the average from scored answers and ignores terminal failures', async () => {
      const sessionWithAnswers = {
        ...mockSession,
        questionsAnswered: 2,
        answers: [
          { status: 'completed', aiScore: 8 },
          { status: 'failed', aiScore: null },
        ],
      };
      postgres.client_.theorySession.findFirst
        .mockResolvedValueOnce(sessionWithAnswers)
        .mockResolvedValueOnce({ ...mockCompletedSession, avgScore: 8 });

      const result = await service.completeSession('session_001', 'user_001');

      expect(result.avgScore).toBe(8);
      expect(postgres.client_.theorySession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ avgScore: 8 }) })
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(service.completeSession('bad_id', 'user_001')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should hide another users session with NotFoundException', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(service.completeSession('session_001', 'other_user')).rejects.toThrow(
        NotFoundException
      );
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'other_user' },
        include: { answers: true },
      });
    });

    it('should throw ConflictException when already completed', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockCompletedSession);

      await expect(service.completeSession('session_001', 'user_001')).rejects.toThrow(
        ConflictException
      );
    });

    it('should return avgScore as 0 when no answers exist', async () => {
      const sessionNoAnswers = {
        ...mockSession,
        answers: [],
      };
      postgres.client_.theorySession.findFirst.mockResolvedValue(sessionNoAnswers);
      postgres.client_.theorySession.updateMany.mockResolvedValue({ count: 1 });
      postgres.client_.theorySession.findFirst
        .mockResolvedValueOnce(sessionNoAnswers)
        .mockResolvedValueOnce({
          ...mockSession,
          status: 'completed',
          avgScore: 0,
          completedAt: new Date(),
        });

      const result = await service.completeSession('session_001', 'user_001');

      expect(result.avgScore).toBe(0);
      expect(postgres.client_.theorySession.findFirst).toHaveBeenLastCalledWith({
        where: { id: 'session_001', userId: 'user_001' },
      });
    });

    it('returns 404 if the completed session cannot be reloaded', async () => {
      postgres.client_.theorySession.findFirst
        .mockResolvedValueOnce({ ...mockSession, answers: [] })
        .mockResolvedValueOnce(null);

      await expect(service.completeSession('session_001', 'user_001')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('getAnswerEvaluation', () => {
    it('looks up an answer only after verifying session ownership', async () => {
      const answer = { ...mockAnswer, status: 'completed' };
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.findFirst.mockResolvedValue(answer);

      await expect(
        service.getAnswerEvaluation('session_001', 'answer_001', 'user_001')
      ).resolves.toEqual(answer);
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'user_001' },
      });
      expect(postgres.client_.theoryAnswer.findFirst).toHaveBeenCalledWith({
        where: { id: 'answer_001', sessionId: 'session_001' },
      });
    });

    it('hides an answer when the session belongs to another user', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(
        service.getAnswerEvaluation('session_001', 'answer_001', 'other_user')
      ).rejects.toThrow(NotFoundException);
      expect(postgres.client_.theoryAnswer.findFirst).not.toHaveBeenCalled();
    });

    it('returns not found when an answer is not part of the owned session', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(mockSession);
      postgres.client_.theoryAnswer.findFirst.mockResolvedValue(null);

      await expect(
        service.getAnswerEvaluation('session_001', 'answer_001', 'user_001')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSessionDetail', () => {
    it('should return session with answers', async () => {
      const sessionWithAnswers = {
        ...mockSession,
        answers: [mockAnswer],
      };
      postgres.client_.theorySession.findFirst.mockResolvedValue(sessionWithAnswers);

      const result = await service.getSessionDetail('session_001', 'user_001');

      expect(result).toEqual(sessionWithAnswers);
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'user_001' },
        include: { answers: true },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(service.getSessionDetail('bad_id', 'user_001')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should hide another users session with NotFoundException', async () => {
      postgres.client_.theorySession.findFirst.mockResolvedValue(null);

      await expect(service.getSessionDetail('session_001', 'other_user')).rejects.toThrow(
        NotFoundException
      );
      expect(postgres.client_.theorySession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session_001', userId: 'other_user' },
        include: { answers: true },
      });
    });
  });

  describe('getSessionHistory', () => {
    it('should return paginated session history', async () => {
      postgres.client_.theorySession.findMany.mockResolvedValue([
        mockSession,
        mockCompletedSession,
      ]);
      postgres.client_.theorySession.count.mockResolvedValue(2);

      const result = await service.getSessionHistory('user_001', { page: 1, limit: 20 });

      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should use default pagination values', async () => {
      postgres.client_.theorySession.findMany.mockResolvedValue([]);
      postgres.client_.theorySession.count.mockResolvedValue(0);

      const result = await service.getSessionHistory('user_001', {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(postgres.client_.theorySession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user_001' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('getWeakAreas', () => {
    it('should return topics with avgScore < 7', async () => {
      const sessions = [
        { ...mockSession, topicId: 'topic_001', avgScore: 5 },
        { ...mockSession, id: 'session_002', topicId: 'topic_001', avgScore: 6 },
      ];
      postgres.client_.theorySession.findMany.mockResolvedValue(sessions);
      prisma.topic.findUnique.mockResolvedValue(mockTopic);

      const result = await service.getWeakAreas('user_001');

      expect(result).toHaveLength(1);
      expect(result[0].topicId).toBe('topic_001');
      expect(result[0].topicName).toBe('React');
      expect(result[0].avgScore).toBe(5.5);
      expect(result[0].sessionsCount).toBe(2);
      expect(postgres.client_.theorySession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user_001', status: 'completed', topicId: { not: null } },
      });
    });

    it('should return empty array when no weak areas', async () => {
      const sessions = [{ ...mockSession, topicId: 'topic_001', avgScore: 8 }];
      postgres.client_.theorySession.findMany.mockResolvedValue(sessions);

      const result = await service.getWeakAreas('user_001');

      expect(result).toHaveLength(0);
    });

    it('should sort by avgScore ascending', async () => {
      const sessions = [
        { ...mockSession, topicId: 'topic_002', avgScore: 5 },
        { ...mockSession, id: 'session_002', topicId: 'topic_001', avgScore: 3 },
      ];
      postgres.client_.theorySession.findMany.mockResolvedValue(sessions);
      prisma.topic.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        const topics: Record<string, { id: string; name: string; slug: string }> = {
          topic_001: { id: 'topic_001', name: 'CSS', slug: 'css' },
          topic_002: { id: 'topic_002', name: 'Node.js', slug: 'nodejs' },
        };
        return Promise.resolve(topics[id] ?? null);
      });

      const result = await service.getWeakAreas('user_001');

      expect(result).toHaveLength(2);
      expect(result[0].avgScore).toBe(3);
      expect(result[1].avgScore).toBe(5);
    });

    it('ignores sessions without a topic and names deleted topics safely', async () => {
      const sessions = [
        { ...mockSession, topicId: null, avgScore: 2 },
        { ...mockSession, topicId: 'deleted-topic', avgScore: 4 },
      ];
      postgres.client_.theorySession.findMany.mockResolvedValue(sessions);
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.getWeakAreas('user_001')).resolves.toMatchObject([
        { topicId: 'deleted-topic', topicName: 'Unknown Topic', avgScore: 4 },
      ]);
    });

    it('tracks the latest practice time when scores belong to the same topic', async () => {
      const earlier = new Date('2026-07-25T10:00:00Z');
      const later = new Date('2026-07-26T10:00:00Z');
      postgres.client_.theorySession.findMany.mockResolvedValue([
        { ...mockSession, startedAt: earlier, avgScore: 4 },
        { ...mockSession, id: 'session_002', startedAt: later, avgScore: 6 },
      ]);
      prisma.topic.findUnique.mockResolvedValue(mockTopic);

      await expect(service.getWeakAreas('user_001')).resolves.toMatchObject([
        { lastPracticed: later, avgScore: 5 },
      ]);
    });
  });

  describe('getScoreTrend', () => {
    it('should return score trend for completed sessions', async () => {
      const sessions = [
        { startedAt: new Date('2026-07-25T10:00:00Z'), avgScore: 8.0 },
        { startedAt: new Date('2026-07-24T10:00:00Z'), avgScore: 6.5 },
      ];
      postgres.client_.theorySession.findMany.mockResolvedValue(sessions);

      const result = await service.getScoreTrend('user_001', { limit: 7 });

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-07-24');
      expect(result[0].avgScore).toBe(6.5);
      expect(result[1].date).toBe('2026-07-25');
      expect(result[1].avgScore).toBe(8.0);
      expect(postgres.client_.theorySession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user_001', status: 'completed' },
        orderBy: { startedAt: 'desc' },
        take: 7,
        select: { startedAt: true, avgScore: true },
      });
    });

    it('should return empty array when no completed sessions', async () => {
      postgres.client_.theorySession.findMany.mockResolvedValue([]);

      const result = await service.getScoreTrend('user_001', { limit: 7 });

      expect(result).toHaveLength(0);
    });

    it('should use default limit of 7', async () => {
      postgres.client_.theorySession.findMany.mockResolvedValue([]);

      await service.getScoreTrend('user_001', {});

      expect(postgres.client_.theorySession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 7 })
      );
    });
  });
});
