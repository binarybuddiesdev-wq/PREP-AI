import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { PdfStudyGenerationService } from './pdf-study-generation.service.js';
import type { IPdfStudyGenerationJobData } from './pdf-study-generation.types.js';

@Injectable()
export class PdfStudyGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<IPdfStudyGenerationJobData>;
  private dispatchTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly generation: PdfStudyGenerationService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly jobs: JobQueueService,
    @InjectPinoLogger(PdfStudyGenerationWorker.name) private readonly logger: PinoLogger,
    @Optional() private readonly metrics?: MetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    const queueName = JOB_QUEUE_NAMES.PDF_QUESTION_GENERATION;
    this.worker = new Worker<IPdfStudyGenerationJobData>(
      queueName,
      (job) =>
        traceWorkerJob(
          queueName,
          job.data.traceContext,
          () => this.processJob(job),
          this.metrics
            ? (outcome, duration) =>
                this.metrics!.recordWorkerJobAttempt(queueName, outcome, duration)
            : undefined
        ),
      {
        connection: {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: null,
        },
        concurrency: JOB_QUEUE_POLICIES[queueName].concurrency,
        maxStalledCount: 1,
      }
    );
    this.worker.on('failed', this.handleFailedJob);
    this.worker.on('error', this.handleWorkerError);
    await this.reconcile();
    this.dispatchTimer = setInterval(() => void this.reconcile(), 30_000);
    this.dispatchTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    await this.worker?.close();
  }

  private async processJob(job: Job<IPdfStudyGenerationJobData>): Promise<void> {
    if (!job.data.sessionId) throw new Error('PDF question generation job has no session ID');
    await this.generation.generate(job.data.sessionId);
  }

  private readonly handleFailedJob = async (
    job: Job<IPdfStudyGenerationJobData> | undefined,
    error: Error
  ): Promise<void> => {
    this.logger.error(
      {
        jobId: job?.id,
        sessionId: job?.data.sessionId,
        requestId: job?.data.requestId,
        errorName: error.name,
      },
      'PDF question generation job failed'
    );
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await this.generation.markFailed(job.data.sessionId).catch((persistError) => {
      this.logger.error(
        {
          sessionId: job.data.sessionId,
          errorName: persistError instanceof Error ? persistError.name : 'UnknownError',
        },
        'Failed to persist terminal PDF question generation failure'
      );
    });
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'PDF question generation worker encountered an error');
  };

  private async reconcile(): Promise<void> {
    try {
      const sessionIds = await this.postgres.listQueuedPdfStudySessionIds(100);
      for (const sessionId of sessionIds) {
        try {
          await this.jobs.enqueue(
            JOB_QUEUE_NAMES.PDF_QUESTION_GENERATION,
            { idempotencyKey: `pdf-study:${sessionId}`, sessionId },
            'generate'
          );
        } catch (error) {
          this.logger.warn(
            { sessionId, errorName: error instanceof Error ? error.name : 'UnknownError' },
            'PDF question generation dispatch failed; claim will expire for retry'
          );
        }
      }

      const failedJobs = await this.jobs.getFailedJobs<IPdfStudyGenerationJobData>(
        JOB_QUEUE_NAMES.PDF_QUESTION_GENERATION,
        100
      );
      for (const job of failedJobs) {
        await this.generation.markFailed(job.data.sessionId).catch((error) => {
          this.logger.warn(
            {
              sessionId: job.data.sessionId,
              errorName: error instanceof Error ? error.name : 'UnknownError',
            },
            'PDF question generation failure reconciliation will retry'
          );
        });
        await job.remove().catch(() => undefined);
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'PDF question generation reconciliation failed');
    }
  }
}
