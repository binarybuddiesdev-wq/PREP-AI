import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { PdfService } from './pdf.service.js';
import { PdfIndexingService } from './pdf-indexing.service.js';
import type { IPdfIngestionJobData } from './pdf-ingestion.types.js';

@Injectable()
export class PdfIngestionWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<IPdfIngestionJobData>;
  private reconciliationTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly indexing: PdfIndexingService,
    private readonly pdfs: PdfService,
    private readonly jobs: JobQueueService,
    @InjectPinoLogger(PdfIngestionWorker.name) private readonly logger: PinoLogger,
    @Optional() private readonly metrics?: MetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    const queueName = JOB_QUEUE_NAMES.PDF_INGESTION;
    this.worker = new Worker<IPdfIngestionJobData>(
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
    this.reconciliationTimer = setInterval(() => void this.reconcile(), 30_000);
    this.reconciliationTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconciliationTimer) clearInterval(this.reconciliationTimer);
    await this.worker?.close();
  }

  private async processJob(job: Job<IPdfIngestionJobData>): Promise<void> {
    if (job.name === 'delete') {
      if (!job.data.sourceId) throw new Error('PDF deletion job has no source ID');
      await this.indexing.delete(job.data.sourceId);
      return;
    }
    if (!job.data.sourceId || !Number.isInteger(job.data.revision) || job.data.revision < 1) {
      throw new Error('PDF ingestion job is invalid');
    }
    await this.indexing.ingest(job.data.sourceId, job.data.revision);
  }

  private readonly handleFailedJob = async (
    job: Job<IPdfIngestionJobData> | undefined,
    error: Error
  ): Promise<void> => {
    this.logger.error(
      {
        jobId: job?.id,
        sourceId: job?.data.sourceId,
        requestId: job?.data.requestId,
        errorName: error.name,
        errorMessage: safeJobErrorMessage(error.message),
      },
      'PDF background job failed'
    );
    if (!job || job.name === 'delete' || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    await this.indexing.markFailed(job.data.sourceId, job.data.revision).catch((persistError) => {
      this.logger.error(
        {
          sourceId: job.data.sourceId,
          errorName: persistError instanceof Error ? persistError.name : 'UnknownError',
        },
        'Failed to persist terminal PDF ingestion failure'
      );
    });
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'PDF ingestion worker encountered an error');
  };

  private async reconcile(): Promise<void> {
    try {
      await this.pdfs.dispatchRecoverableSources();
      const failedJobs = await this.jobs.getFailedJobs<IPdfIngestionJobData>(
        JOB_QUEUE_NAMES.PDF_INGESTION,
        100
      );
      for (const job of failedJobs) {
        if (job.name !== 'delete') {
          await this.indexing.markFailed(job.data.sourceId, job.data.revision).catch((error) => {
            this.logger.warn(
              {
                sourceId: job.data.sourceId,
                errorName: error instanceof Error ? error.name : 'UnknownError',
              },
              'Failed PDF job reconciliation will retry'
            );
          });
        }
        await job.remove().catch((error) => {
          this.logger.warn(
            { jobId: job.id, errorName: error instanceof Error ? error.name : 'UnknownError' },
            'Could not remove reconciled PDF job'
          );
        });
      }
    } catch (error) {
      this.logger.warn(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'PDF queue reconciliation failed'
      );
    }
  }
}

const safeJobErrorMessage = (message: string): string =>
  message
    .replace(/https?:\/\/\S+/giu, '[url]')
    .replace(/Bearer\s+\S+/giu, 'Bearer [redacted]')
    .slice(0, 250);
