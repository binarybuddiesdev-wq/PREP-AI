import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  CODING_DATABASE_UNAVAILABLE,
  CODING_EXECUTION_FAILED,
  CODING_SESSION_COMPLETED_ERROR,
} from '@/common/constants/api.constants.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import type {
  Prisma,
  PrismaClient as PostgresPrismaClient,
} from '../../generated/postgresql-client/index.js';
import type { ICodingExecutionJobData, TCodingExecutionResult } from './coding-execution.types.js';

@Injectable()
export class CodingExecutionService {
  constructor(
    private readonly postgres: PrismaPostgresqlService,
    @InjectPinoLogger(CodingExecutionService.name) private readonly logger: PinoLogger
  ) {}

  async markRunning(executionId: string): Promise<TCodingExecutionResult | null> {
    const pg = this.database();
    try {
      const execution = await pg.codingExecution.findUnique({ where: { id: executionId } });
      if (!execution) throw new Error('Coding execution record is missing');
      if (execution.status === 'completed' && execution.result) {
        return execution.result as unknown as TCodingExecutionResult;
      }
      if (execution.status === 'failed') throw new Error(CODING_EXECUTION_FAILED);
      if (execution.status === 'queued') {
        await pg.codingExecution.updateMany({
          where: { id: executionId, status: 'queued' },
          data: { status: 'running', startedAt: new Date() },
        });
      }
      return null;
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  async complete(
    jobData: ICodingExecutionJobData,
    result: TCodingExecutionResult
  ): Promise<TCodingExecutionResult> {
    const pg = this.database();
    try {
      return await pg.$transaction(async (tx: Prisma.TransactionClient) => {
        const current = await tx.codingExecution.findUnique({
          where: { id: jobData.executionId },
        });
        if (!current) throw new Error('Coding execution record is missing');
        if (current.status === 'completed' && current.result) {
          return current.result as unknown as TCodingExecutionResult;
        }
        if (current.status === 'failed') throw new Error(CODING_EXECUTION_FAILED);

        const transitioned = await tx.codingExecution.updateMany({
          where: { id: jobData.executionId, status: { in: ['queued', 'running'] } },
          data: {
            status: 'completed',
            result: result as unknown as Prisma.InputJsonValue,
            failureMessage: null,
            completedAt: new Date(),
          },
        });
        if (transitioned.count !== 1) {
          const latest = await tx.codingExecution.findUnique({
            where: { id: jobData.executionId },
          });
          if (latest?.status === 'completed' && latest.result) {
            return latest.result as unknown as TCodingExecutionResult;
          }
          throw new Error('Coding execution could not transition to completed');
        }

        if (jobData.operation === 'submit') await this.persistAnswer(tx, jobData, result);
        return result;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw this.databaseError(error);
    }
  }

  async markFailed(executionId: string, failureMessage = CODING_EXECUTION_FAILED): Promise<void> {
    try {
      await this.database().codingExecution.updateMany({
        where: { id: executionId, status: { in: ['queued', 'running'] } },
        data: {
          status: 'failed',
          failureMessage,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  async findQueuedForDispatch(limit = 100): Promise<ICodingExecutionJobData[]> {
    try {
      const queued = await this.database().codingExecution.findMany({
        where: { status: 'queued' },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          sessionId: true,
          userId: true,
          problemId: true,
          operation: true,
          language: true,
          sourceCode: true,
          examples: true,
          quotaKey: true,
          quotaItemKey: true,
          quotaTtlSeconds: true,
          quotaReservationToken: true,
        },
      });
      return queued.map((execution) => {
        const reservationFields = [
          execution.quotaKey,
          execution.quotaItemKey,
          execution.quotaTtlSeconds,
          execution.quotaReservationToken,
        ];
        const hasReservation = reservationFields.some((field) => field !== null);
        if (hasReservation && reservationFields.some((field) => field === null)) {
          throw new Error(`Coding execution ${execution.id} has incomplete quota metadata`);
        }
        return {
          idempotencyKey: execution.id,
          executionId: execution.id,
          sessionId: execution.sessionId,
          userId: execution.userId,
          problemId: execution.problemId,
          operation: execution.operation as ICodingExecutionJobData['operation'],
          language: execution.language as ICodingExecutionJobData['language'],
          code: execution.sourceCode,
          examples: execution.examples,
          quotaReservation: hasReservation
            ? {
                quotaKey: execution.quotaKey!,
                itemKey: execution.quotaItemKey!,
                ttlSeconds: execution.quotaTtlSeconds!,
                reservationToken: execution.quotaReservationToken!,
              }
            : null,
        };
      });
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  private async persistAnswer(
    tx: Prisma.TransactionClient,
    jobData: ICodingExecutionJobData,
    result: TCodingExecutionResult
  ) {
    const sessionChanged = await tx.codingSession.updateMany({
      where: { id: jobData.sessionId, userId: jobData.userId, status: 'in_progress' },
      data: {
        problemsAttempted: { increment: 1 },
      },
    });
    if (sessionChanged.count !== 1) {
      throw new ConflictException(CODING_SESSION_COMPLETED_ERROR);
    }

    const previousAccepted =
      result.status === 'accepted'
        ? await tx.codingAnswer.findFirst({
            where: {
              sessionId: jobData.sessionId,
              problemId: jobData.problemId,
              status: 'accepted',
            },
            select: { id: true },
          })
        : null;
    if (result.status === 'accepted' && !previousAccepted) {
      await tx.codingSession.updateMany({
        where: { id: jobData.sessionId, userId: jobData.userId, status: 'in_progress' },
        data: { problemsSolved: { increment: 1 } },
      });
    }

    await tx.codingAnswer.create({
      data: {
        executionId: jobData.executionId,
        sessionId: jobData.sessionId,
        userId: jobData.userId,
        problemId: jobData.problemId,
        language: jobData.language,
        code: jobData.code,
        status: result.status,
        testCasesPassed: result.testCasesPassed,
        testCasesTotal: result.testCasesTotal,
        runtime: result.runtime,
        memoryUsage: result.memoryUsage,
      },
    });
  }

  private database(): PostgresPrismaClient {
    if (!this.postgres.client_) throw new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE);
    return this.postgres.client_ as PostgresPrismaClient;
  }

  private databaseError(error: unknown) {
    this.logger.error({ err: error }, 'Coding execution persistence failed');
    return new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE, { cause: error });
  }
}
