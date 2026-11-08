import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { questionBankTopics } from './question-bank-catalog.js';
import { QuestionBankReplenishmentService } from './question-bank-replenishment.service.js';
import { getQuestionBankPolicy } from './question-bank.policy.js';

@Injectable()
export class QuestionBankScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly config: ConfigService,
    private readonly replenishment: QuestionBankReplenishmentService,
    @InjectPinoLogger(QuestionBankScheduler.name) private readonly logger: PinoLogger
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    await this.scan().catch((error: unknown) =>
      this.logger.error({ err: error }, 'Question bank scan failed')
    );
    this.timer = setInterval(
      () =>
        void this.scan().catch((error: unknown) =>
          this.logger.error({ err: error }, 'Question bank scan failed')
        ),
      10 * 60_000
    );
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
  }

  async scan(): Promise<void> {
    if (this.running || !this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    this.running = true;
    try {
      const topics = [...questionBankTopics].sort(() => Math.random() - 0.5);
      for (const topic of topics) {
        const kind = topic.category === 'practice' ? 'theory' : 'coding';
        const policy = getQuestionBankPolicy(kind);
        for (const difficulty of policy.difficulties) {
          await this.replenishment.request({
            kind,
            topic: kind === 'theory' ? topic.slug : topic.name,
            difficulty,
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
