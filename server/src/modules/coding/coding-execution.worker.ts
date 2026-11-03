import { ConflictException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { CODING_SESSION_COMPLETED_ERROR } from '@/common/constants/api.constants.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { PistonClient } from './piston.client.js';
import { CodingExecutionService } from './coding-execution.service.js';
import type { ICodingExecutionJobData, TCodingExecutionResult } from './coding-execution.types.js';

@Injectable()
export class CodingExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<ICodingExecutionJobData, TCodingExecutionResult>;
  private failedJobReconciliation?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly piston: PistonClient,
    private readonly executions: CodingExecutionService,
    private readonly jobs: JobQueueService,
    private readonly redis: RedisService,
    @InjectPinoLogger(CodingExecutionWorker.name) private readonly logger: PinoLogger
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;

    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    };
    const queueName = JOB_QUEUE_NAMES.CODING_EXECUTION;
    this.worker = new Worker<ICodingExecutionJobData, TCodingExecutionResult>(
      queueName,
      (job) => traceWorkerJob(queueName, job.data.traceContext, () => this.processJob(job)),
      {
        connection,
        concurrency: JOB_QUEUE_POLICIES[queueName].concurrency,
        maxStalledCount: 1,
      }
    );
    this.worker.on('failed', this.handleFailedJob);
    this.worker.on('error', this.handleWorkerError);
    await this.reconcileFailedJobs();
    await this.dispatchQueuedExecutions();
    this.failedJobReconciliation = setInterval(() => {
      void this.reconcileFailedJobs();
      void this.dispatchQueuedExecutions();
    }, 30_000);
    this.failedJobReconciliation.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.failedJobReconciliation) clearInterval(this.failedJobReconciliation);
    if (!this.worker) return;
    try {
      await this.worker.close();
    } catch (error) {
      this.logger.error({ err: error }, 'Coding execution worker may remain open during shutdown');
      throw error;
    }
  }

  private async processJob(job: Job<ICodingExecutionJobData>): Promise<TCodingExecutionResult> {
    const persistedData = await this.executions.loadPersistedJobData(job.data.executionId);
    const persistedResult = await this.executions.markRunning(persistedData.executionId);
    let result: TCodingExecutionResult;
    try {
      result =
        persistedResult ??
        (await this.executions.complete(
          persistedData,
          await this.piston.execute(
            persistedData.code,
            persistedData.language,
            persistedData.examples
          )
        ));
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      await this.executions.markFailed(persistedData.executionId, CODING_SESSION_COMPLETED_ERROR);
      await this.finalizeSolveQuota(persistedData, 'release');
      throw new UnrecoverableError(CODING_SESSION_COMPLETED_ERROR);
    }
    await this.finalizeSolveQuota(
      persistedData,
      result.status === 'accepted' ? 'solved' : 'release'
    );
    return result;
  }

  private readonly handleFailedJob = async (
    job: Job<ICodingExecutionJobData> | undefined,
    error: Error
  ): Promise<void> => {
    this.logger.error(
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        requestId: job?.data.requestId,
        err: error,
      },
      'Coding execution job failed'
    );
    if (
      !job ||
      (job.attemptsMade < (job.opts.attempts ?? 1) && !(error instanceof UnrecoverableError))
    ) {
      return;
    }

    try {
      const persistedData = await this.executions.loadPersistedJobData(job.data.executionId);
      await this.executions.markFailed(persistedData.executionId);
      await this.finalizeSolveQuota(persistedData, 'release');
    } catch (persistenceError) {
      this.logger.error(
        { executionId: job.data.executionId, err: persistenceError },
        'Failed to persist terminal coding execution failure'
      );
    }
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'Coding execution worker encountered an error');
  };

  private async reconcileFailedJobs(): Promise<void> {
    try {
      const failedJobs = await this.jobs.getFailedJobs<ICodingExecutionJobData>(
        JOB_QUEUE_NAMES.CODING_EXECUTION,
        100
      );
      for (const job of failedJobs) {
        try {
          const persistedData = await this.executions.loadPersistedJobData(job.data.executionId);
          await this.executions.markFailed(persistedData.executionId);
          await this.finalizeSolveQuota(persistedData, 'release');
          await job.remove();
        } catch (error) {
          this.logger.warn(
            { executionId: job.data.executionId, jobId: job.id, err: error },
            'Failed to reconcile a terminal coding execution; it will be retried'
          );
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to read terminal coding jobs for reconciliation');
    }
  }

  private async dispatchQueuedExecutions(): Promise<void> {
    try {
      const queuedExecutions = await this.executions.findQueuedForDispatch(100);
      for (const jobData of queuedExecutions) {
        try {
          await this.jobs.enqueue(JOB_QUEUE_NAMES.CODING_EXECUTION, jobData, 'execute');
        } catch (error) {
          this.logger.warn(
            { executionId: jobData.executionId, err: error },
            'Failed to dispatch a queued coding execution; it will be retried'
          );
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to read queued coding executions for dispatch');
    }
  }

  private async finalizeSolveQuota(
    jobData: ICodingExecutionJobData,
    outcome: 'solved' | 'release'
  ) {
    if (!jobData.quotaReservation) return;
    try {
      await this.redis.finalizeUniqueQuota(
        jobData.quotaReservation.quotaKey,
        jobData.quotaReservation.itemKey,
        outcome,
        jobData.quotaReservation.ttlSeconds,
        jobData.quotaReservation.reservationToken
      );
    } catch (error) {
      this.logger.warn(
        { executionId: jobData.executionId, err: error },
        'Coding solve quota finalization failed; the reservation will expire automatically'
      );
    }
  }
}
