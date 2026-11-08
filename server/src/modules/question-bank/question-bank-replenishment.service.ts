import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { getQuestionBankPolicy, type TQuestionBankKind } from './question-bank.policy.js';
import { QuestionBankRepositoryService } from './question-bank-repository.service.js';

export interface IQuestionBankRefillJob {
  idempotencyKey: string;
  kind: TQuestionBankKind;
  topic: string;
  difficulty: string;
  refillSequence?: number;
  traceContext?: { traceparent?: string };
}

@Injectable()
export class QuestionBankReplenishmentService {
  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobQueueService,
    private readonly repository: QuestionBankRepositoryService,
    private readonly redis: RedisService
  ) {}

  async request(input: Omit<IQuestionBankRefillJob, 'idempotencyKey'>): Promise<boolean> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return false;
    const policy = getQuestionBankPolicy(input.kind);
    const count = await this.repository.count(input.kind, input.topic, input.difficulty);
    if (count > policy.lowWater) return false;
    const hourlyBucket = new Date().toISOString().slice(0, 13);
    await this.enqueue({ ...input, idempotencyKey: `${this.bucketKey(input)}:${hourlyBucket}` });
    return true;
  }

  async enqueue(input: IQuestionBankRefillJob): Promise<string> {
    return this.jobs.enqueue(JOB_QUEUE_NAMES.QUESTION_BANK, input, 'replenish', true);
  }

  async reserveDailyBatch(): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    const maximum = this.config.get<number>('QUESTION_BANK_MAX_BATCHES_PER_DAY', 40);
    const reservation = await this.redis.reserveQuota(
      `question-bank-batches:${day}`,
      maximum,
      86_400
    );
    return reservation.allowed;
  }

  bucketKey(input: Pick<IQuestionBankRefillJob, 'kind' | 'topic' | 'difficulty'>): string {
    return `${input.kind}:${input.topic}:${input.difficulty}`
      .toLowerCase()
      .replace(/[^a-z0-9:_-]/g, '-');
  }
}
