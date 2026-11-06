import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    @InjectPinoLogger(CodingExecutionService.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService
  ) {}

  async markRunning(executionId: string): Promise<TCodingExecutionResult | null> {
    try {
      return await this.withWorkerExecution(executionId, async (tx, owner) => {
        const execution = await tx.codingExecution.findUnique({ where: { id: executionId } });
        if (!execution) throw new Error('Coding execution record is missing');
        if (execution.status === 'completed' && execution.result) {
          return execution.result as unknown as TCodingExecutionResult;
        }
        if (execution.status === 'failed') throw new Error(CODING_EXECUTION_FAILED);
        if (execution.status === 'queued') {
          await tx.codingExecution.updateMany({
            where: { id: executionId, userId: owner.owner_id, status: 'queued' },
            data: { status: 'running', startedAt: new Date(), dispatchClaimedAt: null },
          });
        }
        return null;
      });
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  async complete(
    jobData: ICodingExecutionJobData,
    result: TCodingExecutionResult
  ): Promise<TCodingExecutionResult> {
    try {
      return await this.withWorkerExecution(jobData.executionId, async (tx, owner) => {
        const current = await tx.codingExecution.findUnique({ where: { id: jobData.executionId } });
        if (!current) throw new Error('Coding execution record is missing');
        if (current.status === 'completed' && current.result) {
          return current.result as unknown as TCodingExecutionResult;
        }
        if (current.status === 'failed') throw new Error(CODING_EXECUTION_FAILED);

        const transitioned = await tx.codingExecution.updateMany({
          where: {
            id: jobData.executionId,
            userId: owner.owner_id,
            status: { in: ['queued', 'running'] },
          },
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

        const persistedJobData = this.toJobData(current);
        if (persistedJobData.operation === 'submit')
          await this.persistAnswer(tx, persistedJobData, result);
        return result;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw this.databaseError(error);
    }
  }

  async markFailed(executionId: string, failureMessage = CODING_EXECUTION_FAILED): Promise<void> {
    try {
      await this.withWorkerExecution(executionId, async (tx, owner) => {
        await tx.codingExecution.updateMany({
          where: { id: executionId, userId: owner.owner_id, status: { in: ['queued', 'running'] } },
          data: { status: 'failed', failureMessage, completedAt: new Date() },
        });
      });
    } catch (error) {
      throw this.databaseError(error);
    }
  }

  async findQueuedForDispatch(limit = 100): Promise<ICodingExecutionJobData[]> {
    try {
      const worker = this.workerDatabase();
      const usesRestrictedWorkerRole = Boolean(this.config.get<string>('POSTGRESQL_WORKER_URL'));
      const queued = usesRestrictedWorkerRole
        ? await worker.$queryRaw<Array<{ execution_id: string }>>`
          SELECT execution_id FROM public.prepai_list_queued_coding_execution_ids(${limit}::integer)
        `
        : await worker.$queryRaw<Array<{ execution_id: string }>>`
          WITH candidates AS (
            SELECT id FROM public."CodingExecution"
            WHERE status = 'queued'
              AND ("dispatchClaimedAt" IS NULL OR "dispatchClaimedAt" < now() - interval '30 seconds')
            ORDER BY "createdAt" ASC
            LIMIT LEAST(GREATEST(${limit}::integer, 1), 100)
            FOR UPDATE SKIP LOCKED
          )
          UPDATE public."CodingExecution" AS execution
          SET "dispatchClaimedAt" = now()
          FROM candidates
          WHERE execution.id = candidates.id
          RETURNING execution.id AS execution_id
        `;
      return await Promise.all(
        queued.map(({ execution_id }) => this.loadPersistedJobData(execution_id))
      );
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

  async loadPersistedJobData(executionId: string): Promise<ICodingExecutionJobData> {
    return this.withWorkerExecution(executionId, async (tx) => {
      const execution = await tx.codingExecution.findUnique({ where: { id: executionId } });
      if (!execution) throw new Error(`Coding execution ${executionId} is missing`);
      return this.toJobData(execution);
    });
  }

  private toJobData(execution: {
    id: string;
    sessionId: string;
    userId: string;
    problemId: string;
    operation: string;
    language: string;
    sourceCode: string;
    examples: unknown;
    quotaKey: string | null;
    quotaItemKey: string | null;
    quotaTtlSeconds: number | null;
    quotaReservationToken: string | null;
  }): ICodingExecutionJobData {
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
  }

  private async withWorkerExecution<T>(
    executionId: string,
    operation: (
      transaction: Prisma.TransactionClient,
      owner: { owner_id: string; session_id: string }
    ) => Promise<T>
  ): Promise<T> {
    const worker = this.workerDatabase();
    let owner: { owner_id: string; session_id: string } | undefined;
    if (this.config.get<string>('POSTGRESQL_WORKER_URL')) {
      [owner] = await worker.$queryRaw<
        Array<{ owner_id: string; session_id: string }>
      >`SELECT owner_id, session_id FROM public.prepai_get_coding_execution_owner(${executionId})`;
    } else {
      const execution = await worker.codingExecution.findUnique({
        where: { id: executionId },
        select: { userId: true, sessionId: true },
      });
      if (execution) owner = { owner_id: execution.userId, session_id: execution.sessionId };
    }
    if (!owner) throw new Error('Coding execution record is missing');

    return this.postgres.withWorkerJobContext(executionId, async (transaction) => {
      if (!owner) throw new Error('Coding execution record is missing');
      await this.postgres.setTenantContext(transaction, owner.owner_id);
      await this.postgres.setWorkerSessionContext(transaction, owner.session_id);
      return operation(transaction, owner);
    });
  }

  private workerDatabase(): PostgresPrismaClient {
    if (!this.postgres.workerClient_)
      throw new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE);
    return this.postgres.workerClient_ as PostgresPrismaClient;
  }

  private databaseError(error: unknown) {
    this.logger.error({ err: error }, 'Coding execution persistence failed');
    return new ServiceUnavailableException(CODING_DATABASE_UNAVAILABLE, { cause: error });
  }
}
