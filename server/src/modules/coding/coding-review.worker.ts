import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { CodingReviewService } from './coding-review.service.js';
import type { ICodingReviewJobData } from './coding-review.types.js';

@Injectable()
export class CodingReviewWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<ICodingReviewJobData>;
  private reconciliation?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly reviews: CodingReviewService,
    private readonly jobs: JobQueueService,
    @InjectPinoLogger(CodingReviewWorker.name) private readonly logger: PinoLogger,
    @Optional() private readonly metrics?: MetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    const queueName = JOB_QUEUE_NAMES.CODING_REVIEW;
    this.worker = new Worker<ICodingReviewJobData>(
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
    await this.reconcileFailedJobs();
    await this.dispatchQueuedReviews();
    this.reconciliation = setInterval(() => {
      void this.reconcileFailedJobs();
      void this.dispatchQueuedReviews();
    }, 30_000);
    this.reconciliation.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconciliation) clearInterval(this.reconciliation);
    if (!this.worker) return;
    try {
      await this.worker.close();
    } catch (error) {
      this.logger.error({ err: error }, 'Coding review worker may remain open during shutdown');
      throw error;
    }
  }

  private async processJob(job: Job<ICodingReviewJobData>): Promise<void> {
    await this.reviews.review(job.data.executionId);
  }

  private readonly handleFailedJob = async (
    job: Job<ICodingReviewJobData> | undefined,
    error: Error
  ): Promise<void> => {
    this.logger.error(
      {
        executionId: job?.data.executionId,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        requestId: job?.data.requestId,
        err: error,
      },
      'Coding review job failed'
    );
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    try {
      await this.reviews.markFailed(job.data.executionId);
    } catch (persistenceError) {
      this.logger.error(
        { executionId: job.data.executionId, err: persistenceError },
        'Failed to persist terminal coding review failure'
      );
    }
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'Coding review worker encountered an error');
  };

  private async reconcileFailedJobs(): Promise<void> {
    try {
      const failed = await this.jobs.getFailedJobs<ICodingReviewJobData>(
        JOB_QUEUE_NAMES.CODING_REVIEW,
        100
      );
      for (const job of failed) {
        try {
          await this.reviews.markFailed(job.data.executionId);
          await job.remove();
        } catch (error) {
          this.logger.warn(
            { executionId: job.data.executionId, jobId: job.id, err: error },
            'Failed to reconcile a terminal code review; it will be retried'
          );
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to read terminal code review jobs');
    }
  }

  private async dispatchQueuedReviews(): Promise<void> {
    try {
      const queued = await this.reviews.findQueuedForDispatch(100);
      for (const jobData of queued) {
        try {
          await this.jobs.enqueue(JOB_QUEUE_NAMES.CODING_REVIEW, jobData, 'review');
        } catch (error) {
          this.logger.warn(
            { executionId: jobData.executionId, err: error },
            'Failed to dispatch a queued code review; it will be retried'
          );
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to read queued code reviews for dispatch');
    }
  }
}
