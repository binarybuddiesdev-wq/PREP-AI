import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { getCodingLimits } from '@/common/utils/role-limits.js';
import {
  CODING_DAILY_LIMIT_REACHED,
  CODING_DATABASE_UNAVAILABLE,
  CODING_EXECUTION_FAILED,
  CODING_PROBLEM_NOT_ASSIGNED,
  CODING_SESSION_COMPLETED_ERROR,
  CODING_SESSION_NOT_FOUND,
  CODING_SUBMISSION_IN_PROGRESS,
} from '@/common/constants/api.constants.js';
import type { ICodingExecutionJobData } from './coding-execution.types.js';
import type {
  Prisma,
  PrismaClient as PostgresPrismaClient,
} from '../../generated/postgresql-client/index.js';
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

  async startSession(dto: StartCodingSessionDto, userId: string) {
    const pg = this.database();
    try {
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
      return await pg.codingSession.create({ data: { userId, problemIds } });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.databaseError(error);
    }
  }

  async runCode(sessionId: string, userId: string, dto: ExecuteCodingDto) {
    const { problem, session } = await this.loadSessionProblem(sessionId, userId, dto.problemId);
    this.assertInProgress(session);
    await this.reserveExecutionCapacity(userId);
    return this.createExecution(sessionId, userId, dto, problem.examples, 'run', null);
  }

  async submitSolution(sessionId: string, userId: string, dto: ExecuteCodingDto) {
    const { problem, session } = await this.loadSessionProblem(sessionId, userId, dto.problemId);
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
    const executionId = randomUUID();
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
      const execution = await this.database().codingExecution.findFirst({
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
      });
      if (!execution) throw new NotFoundException('Coding execution not found');
      return execution;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw this.databaseError(error);
    }
  }

  async getSessionDetail(sessionId: string, userId: string) {
    try {
      const session = await this.database().codingSession.findFirst({
        where: { id: sessionId, userId },
        include: { answers: { orderBy: { createdAt: 'asc' } } },
      });
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
      const session = await pg.codingSession.findFirst({ where: { id: sessionId, userId } });
      if (!session) throw new NotFoundException(CODING_SESSION_NOT_FOUND);
      if (session.status !== 'in_progress') {
        throw new ConflictException(CODING_SESSION_COMPLETED_ERROR);
      }
      const completedAt = new Date();
      const updated = await pg.codingSession.updateMany({
        where: { id: sessionId, userId, status: 'in_progress' },
        data: { status: 'completed', completedAt },
      });
      if (updated.count !== 1) throw new ConflictException(CODING_SESSION_COMPLETED_ERROR);
      return { ...session, status: 'completed', completedAt };
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
      const [sessions, total] = await Promise.all([
        pg.codingSession.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        pg.codingSession.count({ where: { userId } }),
      ]);
      return { sessions, total, page, limit };
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  private async loadSessionProblem(sessionId: string, userId: string, problemId: string) {
    let session;
    try {
      session = await this.database().codingSession.findFirst({ where: { id: sessionId, userId } });
    } catch (error) {
      throw this.databaseError(error);
    }
    if (!session) throw new NotFoundException(CODING_SESSION_NOT_FOUND);
    if (!session.problemIds.includes(problemId)) {
      throw new NotFoundException(CODING_PROBLEM_NOT_ASSIGNED);
    }

    try {
      const problem = await this.database().codingQuestion.findFirst({ where: { id: problemId } });
      if (!problem) throw new NotFoundException('Coding problem not found');
      return { session, problem };
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
    executionId = randomUUID()
  ) {
    const queueJobId = this.jobs.getJobId(JOB_QUEUE_NAMES.CODING_EXECUTION, executionId);
    let execution;
    try {
      execution = await this.database().codingExecution.create({
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
      });
    } catch (error) {
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
        await this.database().codingExecution.updateMany({
          where: { id: executionId, status: 'queued' },
          data: {
            status: 'failed',
            failureMessage: CODING_EXECUTION_FAILED,
            completedAt: new Date(),
          },
        });
      } catch (persistenceError) {
        this.logger.error(
          { executionId, err: persistenceError },
          'Failed to persist coding execution queue failure'
        );
      }
      throw error;
    }
    return {
      id: execution.id,
      sessionId: execution.sessionId,
      operation: execution.operation,
      status: execution.status,
      createdAt: execution.createdAt,
    };
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
