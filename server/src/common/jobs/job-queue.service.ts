import { createHash } from 'node:crypto';
import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Queue } from 'bullmq';
import {
  JOB_QUEUE_BACKOFF_DELAY_MS,
  JOB_QUEUE_DEFAULT_NAME,
  JOB_QUEUE_NAMES,
  JOB_QUEUE_POLICIES,
  JOB_QUEUE_RETENTION_SECONDS,
  TJobQueueName,
} from './job-queue.constants.js';
import { CODING_QUEUE_UNAVAILABLE } from '@/common/constants/api.constants.js';

@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly queues = new Map<TJobQueueName, Queue>();

  constructor(
    config: ConfigService,
    @InjectPinoLogger(JobQueueService.name) private readonly logger: PinoLogger
  ) {
    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);

    for (const queueName of Object.values(JOB_QUEUE_NAMES)) {
      const queue = new Queue(queueName, {
        connection: { host, port, maxRetriesPerRequest: 1, enableOfflineQueue: false },
        defaultJobOptions: {
          attempts: JOB_QUEUE_POLICIES[queueName].attempts,
          backoff: { type: 'exponential', delay: JOB_QUEUE_BACKOFF_DELAY_MS },
          removeOnComplete: { age: JOB_QUEUE_RETENTION_SECONDS, count: 1000 },
          removeOnFail: { age: JOB_QUEUE_RETENTION_SECONDS, count: 5000 },
        },
      });
      queue.on('error', (error: Error) => {
        this.logger.error({ queueName, err: error }, 'Background job queue connection failed');
      });

      this.queues.set(queueName, queue);
    }
  }

  async enqueue<TData extends { idempotencyKey: string }>(
    queueName: TJobQueueName,
    data: TData,
    jobName = JOB_QUEUE_DEFAULT_NAME
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new ServiceUnavailableException(CODING_QUEUE_UNAVAILABLE);
    }

    try {
      const job = await queue.add(jobName, data, {
        jobId: this.getJobId(queueName, data.idempotencyKey),
      });
      return job.id ?? this.getJobId(queueName, data.idempotencyKey);
    } catch (error) {
      throw new ServiceUnavailableException(CODING_QUEUE_UNAVAILABLE, { cause: error });
    }
  }

  async getFailedJobs<TData = unknown>(queueName: TJobQueueName, limit = 100) {
    const queue = this.queues.get(queueName);
    if (!queue) return [];
    return (await queue.getJobs(['failed'], 0, Math.max(0, limit - 1))) as Job<TData>[];
  }

  getJobId(queueName: TJobQueueName, idempotencyKey: string): string {
    return createHash('sha256').update(`${queueName}:${idempotencyKey}`).digest('hex');
  }

  async onModuleDestroy(): Promise<void> {
    const results = await Promise.allSettled(
      [...this.queues.values()].map((resource) => resource.close())
    );
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    if (failures.length > 0) {
      const error = new AggregateError(
        failures.map((failure) => failure.reason),
        'One or more background job connections failed to close'
      );
      this.logger.error(
        { err: error },
        'Background job connections may remain open during shutdown'
      );
      throw error;
    }
  }
}
