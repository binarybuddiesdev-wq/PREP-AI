import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { getCodingLimits } from '@/common/utils/role-limits.js';
import {
  createIdempotencyOperationId,
  createIdempotencyRequestFingerprint,
  requireIdempotencyKey,
} from '@/common/idempotency/index.js';
import {
  CODING_DAILY_LIMIT_REACHED,
  CODING_DAILY_REVIEW_LIMIT_REACHED,
  CODING_DATABASE_UNAVAILABLE,
  CODING_EXECUTION_FAILED,
  CODING_PROBLEM_NOT_ASSIGNED,
  CODING_SESSION_COMPLETED_ERROR,
  CODING_SESSION_NOT_FOUND,
  CODING_SUBMISSION_IN_PROGRESS,
  IDEMPOTENCY_KEY_REUSED,
} from '@/common/constants/api.constants.js';
import type { ICodingExecutionJobData } from './coding-execution.types.js';
import type { PrismaClient as PostgresPrismaClient } from '../../generated/postgresql-client/index.js';
import { Prisma } from '../../generated/postgresql-client/index.js';
import {
  CodingSessionHistoryDto,
  ExecuteCodingDto,
  ListCodingProblemsDto,
  StartCodingSessionDto,
} from './dto/index.js';

const CODING_EXECUTION_RATE_LIMIT = 10;
const CODING_EXECUTION_RATE_WINDOW_SECONDS = 60;

@Injectable()
export class CodingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly redis: RedisService,
    private readonly jobs: JobQueueService,
    private readonly config: ConfigService,
    @InjectPinoLogger(CodingService.name) private readonly logger: PinoLogger
  ) {}

  async listProblems(dto: ListCodingProblemsDto) {
    const pg = this.database();
    try {
      const where: Prisma.CodingQuestionWhereInput = {};
      if (dto.topic) where.topic = dto.topic;
      if (dto.difficulty) where.difficulty = dto.difficulty;
      return await pg.codingQuestion.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          difficulty: true,
          topic: true,
        },
        orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
      });
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  async getProblem(idOrSlug: string) {
    const pg = this.database();
    try {
      const problem = await pg.codingQuestion.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      });
      if (!problem) throw new NotFoundException('Coding problem not found');
      return problem;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.databaseError(error);
    }
  }

  async startSession(
    dto: StartCodingSessionDto,
    userId: string,
    idempotencyKey: string | undefined
  ) {
    const validatedIdempotencyKey = requireIdempotencyKey(idempotencyKey);
    const pg = this.database();
    const sessionId = createIdempotencyOperationId(
      userId,
      'coding-session',
      validatedIdempotencyKey
    );
    const findExistingSession = () =>
      this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingSession.findFirst({ where: { id: sessionId, userId } })
      );

    try {
      const existing = await findExistingSession();
      if (existing) return this.replaySessionStart(existing, dto.problemIds);

      const selected = dto.problemIds?.length
        ? await pg.codingQuestion.findMany({
            where: { id: { in: dto.problemIds } },
            select: { id: true },
          })
        : await pg.codingQuestion.findMany({ select: { id: true }, take: 10 });
      const problemIds = selected.map((problem: { id: string }) => problem.id);
      if (dto.problemIds?.length && problemIds.length !== dto.problemIds.length) {
        throw new NotFoundException('One or more coding problems were not found');
      }
      if (problemIds.length === 0) throw new NotFoundException('No coding problems are available');
      return await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingSession.create({ data: { id: sessionId, userId, problemIds } })
      );
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (this.isUniqueViolation(error)) {
        const winner = await findExistingSession();
        if (winner) return this.replaySessionStart(winner, dto.problemIds);
      }
      if (error instanceof ConflictException) throw error;
      throw this.databaseError(error);
    }
  }

  private replaySessionStart<T extends { problemIds: string[] }>(
    session: T,
    requestedProblemIds?: string[]
  ): T {
    if (!requestedProblemIds?.length) return session;

    const persistedFingerprint = createIdempotencyRequestFingerprint('coding-session', {
      problemIds: [...session.problemIds].sort(),
    });
    const requestFingerprint = createIdempotencyRequestFingerprint('coding-session', {
      problemIds: [...requestedProblemIds].sort(),
    });
    if (persistedFingerprint !== requestFingerprint) {
      throw new ConflictException(IDEMPOTENCY_KEY_REUSED);
    }
    return session;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  async runCode(sessionId: string, userId: string, dto: ExecuteCodingDto, idempotencyKey: string) {
    requireIdempotencyKey(idempotencyKey);
    const session = await this.loadOwnedSession(sessionId, userId);
    const executionId = createIdempotencyOperationId(userId, 'coding-execution', idempotencyKey);
    const replay = await this.findReplay(sessionId, userId, executionId, dto, 'run');
    if (replay) return replay;
    const problem = await this.loadSessionProblem(session, dto.problemId);
    this.assertInProgress(session);
    await this.reserveExecutionCapacity(userId);
    return this.createExecution(sessionId, userId, dto, problem.examples, 'run', null, executionId);
  }

  async submitSolution(
    sessionId: string,
    userId: string,
    dto: ExecuteCodingDto,
    idempotencyKey: string
  ) {
    requireIdempotencyKey(idempotencyKey);
    const session = await this.loadOwnedSession(sessionId, userId);
    const executionId = createIdempotencyOperationId(userId, 'coding-execution', idempotencyKey);
    const replay = await this.findReplay(sessionId, userId, executionId, dto, 'submit');
    if (replay) return replay;
    const problem = await this.loadSessionProblem(session, dto.problemId);
    this.assertInProgress(session);
    await this.reserveExecutionCapacity(userId);

    const roleUser = await this.prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    if (!roleUser) throw new NotFoundException('User not found');
    const dailyLimit = getCodingLimits(roleUser.role, this.config).dailySolved;
    const quotaKey = `coding-solved:${userId}:${this.utcDate()}`;
    const itemKey = `coding-problem:${userId}:${dto.problemId}`;
    const ttlSeconds = this.secondsUntilUtcMidnight();
    let reservation;
    try {
      reservation = await this.redis.reserveUniqueQuota(
        quotaKey,
        itemKey,
        dailyLimit,
        ttlSeconds,
        executionId
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Coding solve quota service unavailable');
      throw new ServiceUnavailableException(
        'Coding solve quota service is temporarily unavailable',
        {
          cause: error,
        }
      );
    }

    if (reservation.status === 'limit') {
      throw new ConflictException(CODING_DAILY_LIMIT_REACHED);
    }
    if (reservation.status === 'in_progress') {
      const concurrentReplay = await this.findReplay(sessionId, userId, executionId, dto, 'submit');
      if (concurrentReplay) return concurrentReplay;
      throw new ConflictException(CODING_SUBMISSION_IN_PROGRESS);
    }

    const quotaReservation =
      reservation.status === 'reserved'
        ? { quotaKey, itemKey, ttlSeconds, reservationToken: executionId }
        : null;
    try {
      return await this.createExecution(
        sessionId,
        userId,
        dto,
        problem.examples,
        'submit',
        quotaReservation,
        executionId
      );
    } catch (error) {
      if (quotaReservation) {
        await this.releaseReservation(quotaKey, itemKey, ttlSeconds, executionId);
      }
      throw error;
    }
  }

  async getExecution(sessionId: string, executionId: string, userId: string) {
    try {
      const execution = await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingExecution.findFirst({
          where: { id: executionId, sessionId, userId },
          select: {
            id: true,
            sessionId: true,
            problemId: true,
            operation: true,
            language: true,
            status: true,
            result: true,
            failureMessage: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            answer: true,
          },
        })
      );
      if (!execution) throw new NotFoundException('Coding execution not found');
      return execution;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.databaseError(error);
    }
  }

  async requestCodeReview(sessionId: string, executionId: string, userId: string) {
    const execution = await this.findReviewableExecution(sessionId, executionId, userId);
    if (!execution) throw new NotFoundException('Coding execution not found');
    if (execution.operation !== 'submit' || execution.status !== 'completed' || !execution.answer) {
      throw new ConflictException('Only completed submissions can be reviewed');
    }

    const answer = execution.answer;
    if (['queued', 'running', 'completed'].includes(answer.aiReviewStatus)) {
      return this.toReviewResponse(answer);
    }
    if (!['not_requested', 'failed'].includes(answer.aiReviewStatus)) {
      throw new ConflictException('Coding review is in an invalid state');
    }

    const roleUser = await this.prisma.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    if (!roleUser) throw new NotFoundException('User not found');
    const reviewLimit = getCodingLimits(roleUser.role, this.config).dailyReviews;
    const quotaKey = `coding-reviews:${userId}:${this.utcDate()}`;
    let reservation: { allowed: boolean };
    try {
      reservation = await this.redis.reserveQuota(
        quotaKey,
        reviewLimit,
        this.secondsUntilUtcMidnight()
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Coding review quota service unavailable');
      throw new ServiceUnavailableException(
        'Coding review quota service is temporarily unavailable',
        {
          cause: error,
        }
      );
    }
    if (!reservation.allowed) throw new ConflictException(CODING_DAILY_REVIEW_LIMIT_REACHED);

    let quotaReserved = true;
    const releaseQuota = async () => {
      if (!quotaReserved) return;
      quotaReserved = false;
      await this.releaseReviewQuota(quotaKey);
    };
    try {
      const updated = await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingAnswer.updateMany({
          where: { id: answer.id, userId, aiReviewStatus: answer.aiReviewStatus },
          data: {
            aiReviewStatus: 'queued',
            aiReviewFailureMessage: null,
            aiReviewJson: Prisma.DbNull,
            aiReviewProvider: null,
            aiReviewModel: null,
            aiReviewPromptVersion: null,
          },
        })
      );
      if (updated.count !== 1) {
        await releaseQuota();
        const winner = await this.findReviewableExecution(sessionId, executionId, userId);
        if (winner?.answer) return this.toReviewResponse(winner.answer);
        throw new ConflictException('Coding review state changed before it could be queued');
      }
      quotaReserved = false;

      try {
        await this.jobs.enqueue(
          JOB_QUEUE_NAMES.CODING_REVIEW,
          { idempotencyKey: executionId, executionId },
          'review'
        );
      } catch (error) {
        this.logger.warn(
          { executionId, answerId: answer.id, err: error },
          'Failed to dispatch a queued code review; it will be retried'
        );
      }
      return this.toReviewResponse({
        ...answer,
        aiReviewStatus: 'queued',
        aiReviewFailureMessage: null,
        aiReviewJson: null,
      });
    } catch (error) {
      await releaseQuota();
      throw error;
    }
  }

  private findReviewableExecution(sessionId: string, executionId: string, userId: string) {
    return this.postgres.withTenantContext(userId, (transaction) =>
      transaction.codingExecution.findFirst({
        where: { id: executionId, sessionId, userId },
        select: {
          operation: true,
          status: true,
          answer: {
            select: {
              id: true,
              aiReviewStatus: true,
              aiReviewJson: true,
              aiReviewFailureMessage: true,
            },
          },
        },
      })
    );
  }

  private toReviewResponse(answer: {
    id: string;
    aiReviewStatus: string;
    aiReviewJson: unknown;
    aiReviewFailureMessage: string | null;
  }) {
    return {
      id: answer.id,
      status: answer.aiReviewStatus,
      aiReviewJson: answer.aiReviewJson,
      aiReviewFailureMessage: answer.aiReviewFailureMessage,
    };
  }

  private async releaseReviewQuota(quotaKey: string): Promise<void> {
    try {
      await this.redis.releaseQuota(quotaKey);
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to release a coding review quota reservation');
    }
  }

  async getSessionDetail(sessionId: string, userId: string) {
    try {
      const session = await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingSession.findFirst({
          where: { id: sessionId, userId },
          include: { answers: { orderBy: { createdAt: 'asc' } } },
        })
      );
      if (!session) throw new NotFoundException(CODING_SESSION_NOT_FOUND);
      return session;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.databaseError(error);
    }
  }

  async completeSession(sessionId: string, userId: string) {
    const pg = this.database();
    try {
      return await this.postgres.withTenantContext(userId, async (transaction) => {
        const session = await transaction.codingSession.findFirst({
          where: { id: sessionId, userId },
        });
        if (!session) throw new NotFoundException(CODING_SESSION_NOT_FOUND);
        if (session.status === 'completed') return session;
        if (session.status !== 'in_progress') {
          throw new ConflictException(CODING_SESSION_COMPLETED_ERROR);
        }
        const completedAt = new Date();
        const updated = await transaction.codingSession.updateMany({
          where: { id: sessionId, userId, status: 'in_progress' },
          data: { status: 'completed', completedAt },
        });
        if (updated.count !== 1) {
          const concurrentResult = await transaction.codingSession.findFirst({
            where: { id: sessionId, userId },
          });
          if (!concurrentResult) throw new NotFoundException(CODING_SESSION_NOT_FOUND);
          if (concurrentResult.status === 'completed') return concurrentResult;
          throw new ConflictException(CODING_SESSION_COMPLETED_ERROR);
        }
        return { ...session, status: 'completed', completedAt };
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throw this.databaseError(error);
    }
  }

  async getSessionHistory(userId: string, dto: CodingSessionHistoryDto) {
    const pg = this.database();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    try {
      const [sessions, total] = await this.postgres.withTenantContext(userId, (transaction) =>
        Promise.all([
          transaction.codingSession.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          transaction.codingSession.count({ where: { userId } }),
        ])
      );
      return { sessions, total, page, limit };
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  private async loadOwnedSession(sessionId: string, userId: string) {
    let session;
    try {
      session = await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingSession.findFirst({ where: { id: sessionId, userId } })
      );
    } catch (error) {
      throw this.databaseError(error);
    }
    if (!session) throw new NotFoundException(CODING_SESSION_NOT_FOUND);
    return session as { id: string; userId: string; problemIds: string[]; status: string };
  }

  private async loadSessionProblem(
    session: { id: string; problemIds: string[] },
    problemId: string
  ) {
    if (!session.problemIds.includes(problemId)) {
      throw new NotFoundException(CODING_PROBLEM_NOT_ASSIGNED);
    }

    try {
      const problem = await this.database().codingQuestion.findFirst({ where: { id: problemId } });
      if (!problem) throw new NotFoundException('Coding problem not found');
      return problem;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.databaseError(error);
    }
  }

  private assertInProgress(session: { status: string }) {
    if (session.status !== 'in_progress') {
      throw new ConflictException(CODING_SESSION_COMPLETED_ERROR);
    }
  }

  private async findReplay(
    sessionId: string,
    userId: string,
    executionId: string,
    dto: ExecuteCodingDto,
    operation: 'run' | 'submit'
  ) {
    let execution;
    try {
      execution = await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingExecution.findFirst({ where: { id: executionId, userId } })
      );
    } catch (error) {
      throw this.databaseError(error);
    }
    if (!execution) return null;
    this.assertSameExecutionRequest(execution, sessionId, dto, operation);
    return this.executionSummary(execution);
  }

  private assertSameExecutionRequest(
    execution: {
      sessionId: string;
      problemId: string;
      operation: string;
      language: string;
      sourceCode: string;
    },
    sessionId: string,
    dto: ExecuteCodingDto,
    operation: 'run' | 'submit'
  ) {
    const expected = createIdempotencyRequestFingerprint('coding-execution', {
      sessionId,
      problemId: dto.problemId,
      operation,
      language: dto.language,
      code: dto.code,
    });
    const persisted = createIdempotencyRequestFingerprint('coding-execution', {
      sessionId: execution.sessionId,
      problemId: execution.problemId,
      operation: execution.operation,
      language: execution.language,
      code: execution.sourceCode,
    });
    if (expected !== persisted) throw new ConflictException(IDEMPOTENCY_KEY_REUSED);
  }

  private executionSummary(execution: {
    id: string;
    sessionId: string;
    operation: string;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: execution.id,
      sessionId: execution.sessionId,
      operation: execution.operation,
      status: execution.status,
      createdAt: execution.createdAt,
    };
  }

  private async createExecution(
    sessionId: string,
    userId: string,
    dto: ExecuteCodingDto,
    examples: unknown,
    operation: 'run' | 'submit',
    quotaReservation: {
      quotaKey: string;
      itemKey: string;
      ttlSeconds: number;
      reservationToken: string;
    } | null,
    executionId: string
  ) {
    const queueJobId = this.jobs.getJobId(JOB_QUEUE_NAMES.CODING_EXECUTION, executionId);
    let execution;
    try {
      execution = await this.postgres.withTenantContext(userId, (transaction) =>
        transaction.codingExecution.create({
          data: {
            id: executionId,
            sessionId,
            userId,
            problemId: dto.problemId,
            operation,
            language: dto.language,
            status: 'queued',
            sourceCode: dto.code,
            examples: examples as Prisma.InputJsonValue,
            queueJobId,
            quotaKey: quotaReservation?.quotaKey ?? null,
            quotaItemKey: quotaReservation?.itemKey ?? null,
            quotaTtlSeconds: quotaReservation?.ttlSeconds ?? null,
            quotaReservationToken: quotaReservation?.reservationToken ?? null,
          },
        })
      );
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        const replay = await this.findReplay(sessionId, userId, executionId, dto, operation);
        if (replay) return replay;
      }
      throw this.databaseError(error);
    }

    const jobData: ICodingExecutionJobData = {
      idempotencyKey: executionId,
      executionId,
      sessionId,
      userId,
      problemId: dto.problemId,
      operation,
      code: dto.code,
      language: dto.language,
      examples,
      quotaReservation,
    };
    try {
      await this.jobs.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, jobData, 'execute');
    } catch (error) {
      try {
        await this.postgres.withTenantContext(userId, (transaction) =>
          transaction.codingExecution.updateMany({
            where: { id: executionId, userId, status: 'queued' },
            data: {
              status: 'failed',
              failureMessage: CODING_EXECUTION_FAILED,
              completedAt: new Date(),
            },
          })
        );
      } catch (persistenceError) {
        this.logger.error(
          { executionId, err: persistenceError },
          'Failed to persist coding execution queue failure'
        );
      }
      throw error;
    }
    return this.executionSummary(execution);
  }

  private async reserveExecutionCapacity(userId: string) {
    let reservation;
    try {
      reservation = await this.redis.reserveQuota(
        `coding-execution:${userId}`,
        CODING_EXECUTION_RATE_LIMIT,
        CODING_EXECUTION_RATE_WINDOW_SECONDS
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Coding execution rate limiter unavailable');
      throw new ServiceUnavailableException(
        'Code execution rate limiter is temporarily unavailable',
        { cause: error }
      );
    }
    if (!reservation.allowed) {
      throw new HttpException('Code execution rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private database(): PostgresPrismaClient {
    if (!this.postgres.client_) {
      throw new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE);
    }
    return this.postgres.client_ as PostgresPrismaClient;
  }

  private databaseError(error: unknown) {
    this.logger.error({ err: error }, 'Coding PostgreSQL operation failed');
    return new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE, { cause: error });
  }

  private async releaseReservation(
    quotaKey: string,
    itemKey: string,
    ttlSeconds: number,
    reservationToken: string
  ) {
    try {
      await this.redis.finalizeUniqueQuota(
        quotaKey,
        itemKey,
        'release',
        ttlSeconds,
        reservationToken
      );
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to release a coding solve reservation');
    }
  }

  private utcDate() {
    return new Date().toISOString().slice(0, 10);
  }

  private secondsUntilUtcMidnight() {
    const now = new Date();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
  }
}
