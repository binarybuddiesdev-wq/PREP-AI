import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { NotificationsService } from './notifications.service.js';
import type { EmailReminderJob } from './email.types.js';

@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<EmailReminderJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    @InjectPinoLogger(EmailWorker.name) private readonly logger: PinoLogger,
    @Optional() private readonly metrics?: MetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    if (
      !this.config.get<string>('RESEND_API_KEY') ||
      !this.config.get<string>('RESEND_FROM_EMAIL') ||
      !this.config.get<string>('EMAIL_UNSUBSCRIBE_SECRET') ||
      !this.config.get<string>('API_BASE_URL')
    ) {
      this.logger.warn(
        'Email worker is disabled until Resend and unsubscribe settings are configured'
      );
      return;
    }

    this.worker = new Worker<EmailReminderJob>(
      JOB_QUEUE_NAMES.EMAIL,
      (job) =>
        traceWorkerJob(
          JOB_QUEUE_NAMES.EMAIL,
          job.data.traceContext,
          () => this.processJob(job),
          this.metrics
            ? (outcome, duration) =>
                this.metrics!.recordWorkerJobAttempt(JOB_QUEUE_NAMES.EMAIL, outcome, duration)
            : undefined
        ),
      {
        connection: {
          host: this.config.get<string>('REDIS_HOST', 'localhost'),
          port: this.config.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: null,
        },
        concurrency: JOB_QUEUE_POLICIES[JOB_QUEUE_NAMES.EMAIL].concurrency,
        maxStalledCount: 1,
      }
    );
    this.worker.on('failed', this.handleFailedJob);
    this.worker.on('error', this.handleWorkerError);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) return;
    await this.worker.close();
  }

  private async processJob(job: Job<EmailReminderJob>): Promise<void> {
    await this.notifications.sendDailyReminder(job.data.userId, job.data.localDate);
  }

  private readonly handleFailedJob = (
    job: Job<EmailReminderJob> | undefined,
    error: Error
  ): void => {
    this.logger.error(
      {
        userId: job?.data.userId,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        requestId: job?.data.requestId,
        err: error,
      },
      'Email reminder job failed'
    );
  };

  private readonly handleWorkerError = (error: Error): void => {
    this.logger.error({ err: error }, 'Email worker encountered an error');
  };
}
