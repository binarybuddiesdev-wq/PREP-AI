import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { PistonClient } from './piston.client.js';
import type { ICodingExecutionResult, TCodingLanguage } from './piston.client.js';

export interface ICodingExecutionJobData {
  idempotencyKey: string;
  code: string;
  language: TCodingLanguage;
  examples: unknown;
}

@Injectable()
export class CodingExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<ICodingExecutionJobData, ICodingExecutionResult>;

  constructor(
    private readonly config: ConfigService,
    private readonly piston: PistonClient,
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
    this.worker = new Worker<ICodingExecutionJobData, ICodingExecutionResult>(
      queueName,
      (job) => this.processJob(job),
      {
        connection,
        concurrency: JOB_QUEUE_POLICIES[queueName].concurrency,
        maxStalledCount: 1,
      }
    );
    this.worker.on('failed', this.handleFailedJob);
    this.worker.on('error', this.handleWorkerError);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) return;
    try {
      await this.worker.close();
    } catch (error) {
      this.logger.error({ err: error }, 'Coding execution worker may remain open during shutdown');
      throw error;
    }
  }

  private processJob(job: Job<ICodingExecutionJobData>): Promise<ICodingExecutionResult> {
    return this.piston.execute(job.data.code, job.data.language, job.data.examples);
  }

  private readonly handleFailedJob = (
    job: Job<ICodingExecutionJobData> | undefined,
    error: Error
  ): void => {
    this.logger.error(
      { jobId: job?.id, attemptsMade: job?.attemptsMade, err: error },
      'Coding execution job failed'
    );
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'Coding execution worker encountered an error');
  };
}
