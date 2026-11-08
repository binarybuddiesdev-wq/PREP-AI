import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job, Worker } from 'bullmq';
import { JOB_QUEUE_NAMES, JOB_QUEUE_POLICIES } from '@/common/jobs/job-queue.constants.js';
import { traceWorkerJob } from '@/telemetry/worker-tracing.js';
import { MetricsService } from '@/modules/metrics/metrics.service.js';
import { getQuestionBankPolicy } from './question-bank.policy.js';
import type { IQuestionBankRefillJob } from './question-bank-replenishment.service.js';
import { QuestionBankReplenishmentService } from './question-bank-replenishment.service.js';
import { QuestionBankRepositoryService } from './question-bank-repository.service.js';
import { QuestionBankGeneratorService } from './question-bank-generator.service.js';
import { questionBankTopicsBySlug } from './question-bank-catalog.js';

@Injectable()
export class QuestionBankWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<IQuestionBankRefillJob, { inserted: number }>;
  constructor(
    private readonly config: ConfigService,
    private readonly refill: QuestionBankReplenishmentService,
    private readonly repository: QuestionBankRepositoryService,
    private readonly generator: QuestionBankGeneratorService,
    @InjectPinoLogger(QuestionBankWorker.name) private readonly logger: PinoLogger,
    @Optional() private readonly metrics?: MetricsService
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    const queueName = JOB_QUEUE_NAMES.QUESTION_BANK;
    this.worker = new Worker<IQuestionBankRefillJob, { inserted: number }>(
      queueName,
      (job) =>
        traceWorkerJob(
          queueName,
          job.data.traceContext,
          () => this.process(job),
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
    this.worker.on('failed', (job, error) =>
      this.logger.error({ jobId: job?.id, err: error }, 'Question bank refill failed')
    );
    this.worker.on('error', (error) =>
      this.logger.error({ err: error }, 'Question bank worker failed')
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<IQuestionBankRefillJob>): Promise<{ inserted: number }> {
    const { kind, topic, difficulty } = job.data;
    const before = await this.repository.count(kind, topic, difficulty);
    const policy = getQuestionBankPolicy(kind);
    if (before >= policy.target) return { inserted: 0 };
    if (job.attemptsMade === 0 && !(await this.refill.reserveDailyBatch())) {
      this.logger.warn({ kind, topic, difficulty }, 'Question bank daily generation limit reached');
      return { inserted: 0 };
    }
    const count = Math.min(policy.batchSize, policy.target - before);
    let inserted: number;
    if (kind === 'theory') {
      const topicInfo = questionBankTopicsBySlug(topic);
      if (!topicInfo || topicInfo.category !== 'practice') throw new Error('Unknown theory topic');
      const context = await this.repository.getTheoryContext(topic);
      const batch = await this.generator.generateTheory({
        topicSlug: topic,
        topicName: topicInfo.name,
        difficulty: difficulty as 'Junior' | 'Mid' | 'Senior',
        count,
        existingPrompts: context.records.map((record) => record.question),
        existingConceptFingerprints: new Set(context.concepts.map((claim) => claim.fingerprint)),
      });
      inserted = await this.repository.persistTheoryBatch(batch);
    } else {
      const context = await this.repository.getCodingContext(topic);
      const known = context.flatMap((record) =>
        record.conceptFingerprint ? [record.conceptFingerprint] : []
      );
      const batch = await this.generator.generateCoding({
        topic,
        difficulty: difficulty as 'Easy' | 'Medium' | 'Hard',
        count,
        existingPrompts: context.map((record) => record.description),
        existingSlugs: context.map((record) => record.slug),
        existingConceptFingerprints: new Set(known),
        existingQuestionFingerprints: new Set(
          context.flatMap((record) => (record.promptFingerprint ? [record.promptFingerprint] : []))
        ),
      });
      inserted = await this.repository.persistCodingBatch(batch);
    }
    return { inserted };
  }
}
