import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';
import type { ITheoryEvaluationJobData } from './theory-evaluation.types.js';

@Injectable()
export class TheoryEvaluationWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<ITheoryEvaluationJobData>;
  private queuedJobReconciliation?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly evaluations: TheoryEvaluationService,
    private readonly jobs: JobQueueService,
    @InjectPinoLogger(TheoryEvaluationWorker.name) private readonly logger: PinoLogger
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;

    const queueName = JOB_QUEUE_NAMES.THEORY_EVALUATION;
    this.worker = new Worker<ITheoryEvaluationJobData>(queueName, (job) => this.processJob(job), {
      connection: {
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
        maxRetriesPerRequest: null,
      },
      concurrency: JOB_QUEUE_POLICIES[queueName].concurrency,
      maxStalledCount: 1,
    });
    this.worker.on('failed', this.handleFailedJob);
    this.worker.on('error', this.handleWorkerError);
    await this.reconcileFailedJobs();
    await this.dispatchQueuedEvaluations();
    this.queuedJobReconciliation = setInterval(() => {
      void this.reconcileFailedJobs();
      void this.dispatchQueuedEvaluations();
    }, 30_000);
    this.queuedJobReconciliation.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.queuedJobReconciliation) clearInterval(this.queuedJobReconciliation);
    if (!this.worker) return;
    try {
      await this.worker.close();
    } catch (error) {
      this.logger.error({ err: error }, 'Theory evaluation worker may remain open during shutdown');
      throw error;
    }
  }

  private async processJob(job: Job<ITheoryEvaluationJobData>): Promise<void> {
    await this.evaluations.evaluate(job.data.answerId);
  }

  private readonly handleFailedJob = async (
    job: Job<ITheoryEvaluationJobData> | undefined,
    error: Error
  ): Promise<void> => {
    this.logger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, errorName: error.name },
      'Theory evaluation job failed'
    );
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;

    try {
      await this.evaluations.markFailed(job.data.answerId);
    } catch (persistenceError) {
      this.logger.error(
        { answerId: job.data.answerId, err: persistenceError },
        'Failed to persist terminal theory evaluation failure'
      );
    }
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'Theory evaluation worker encountered an error');
  };

  private async reconcileFailedJobs(): Promise<void> {
    try {
      const failedJobs = await this.jobs.getFailedJobs<ITheoryEvaluationJobData>(
        JOB_QUEUE_NAMES.THEORY_EVALUATION,
        100
      );
      for (const job of failedJobs) {
        try {
          await this.evaluations.markFailed(job.data.answerId);
          await job.remove();
        } catch (error) {
          this.logger.warn(
            { answerId: job.data.answerId, jobId: job.id, err: error },
            'Failed to reconcile a terminal theory evaluation; it will be retried'
          );
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to read terminal theory evaluation jobs');
    }
  }

  private async dispatchQueuedEvaluations(): Promise<void> {
    try {
      const queuedEvaluations = await this.evaluations.findQueuedForDispatch(100);
      for (const jobData of queuedEvaluations) {
        try {
          await this.jobs.enqueue(JOB_QUEUE_NAMES.THEORY_EVALUATION, jobData, 'evaluate');
        } catch (error) {
          this.logger.warn(
            { answerId: jobData.answerId, err: error },
            'Failed to dispatch a queued theory evaluation; it will be retried'
          );
        }
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to read queued theory evaluations for dispatch');
    }
  }
}
