import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { PaymentsService } from './payments.service.js';

interface IPaymentReconciliationJob {
  idempotencyKey: string;
  userId: string;
  traceContext?: { traceparent?: string; tracestate?: string };
  requestId?: string;
}

@Injectable()
export class PaymentReconciliationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  private worker?: Worker<IPaymentReconciliationJob>;

  constructor(
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
    @Optional() private readonly metrics?: MetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    const queueName = JOB_QUEUE_NAMES.PAYMENT_RECONCILIATION;
    this.worker = new Worker<IPaymentReconciliationJob>(
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
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        { jobId: job?.id, attemptsMade: job?.attemptsMade, err: error },
        'Payment reconciliation job failed'
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error({ err: error }, 'Payment reconciliation worker failed');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<IPaymentReconciliationJob>): Promise<void> {
    if (!job.data.userId || !job.data.idempotencyKey)
      throw new Error('Invalid payment reconciliation job');
    await this.payments.processWebhookEvent(job.data.userId, job.data.idempotencyKey);
  }
}
