import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service.js';
import { IDEMPOTENCY_REPLAY_WINDOW_MS } from './idempotency.constants.js';

export class MongoIdempotencyCleanupScheduler {
  private readonly logger = new Logger(MongoIdempotencyCleanupScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOperations(): Promise<number> {
    try {
      const now = new Date();
      const legacyCutoff = new Date(now.getTime() - IDEMPOTENCY_REPLAY_WINDOW_MS);
      const [responseSnapshots, studyChatOperations] = await Promise.all([
        this.prisma.idempotencyOperation.deleteMany({ where: { expiresAt: { lt: now } } }),
        this.prisma.studyChatOperation.deleteMany({
          where: {
            status: 'COMPLETED',
            OR: [
              { expiresAt: { lt: now } },
              { expiresAt: { isSet: false }, updatedAt: { lt: legacyCutoff } },
            ],
          },
        }),
      ]);
      return responseSnapshots.count + studyChatOperations.count;
    } catch {
      this.logger.warn('Could not remove expired idempotency operations');
      return 0;
    }
  }
}
