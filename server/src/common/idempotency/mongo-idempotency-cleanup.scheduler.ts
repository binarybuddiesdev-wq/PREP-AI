import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service.js';

export class MongoIdempotencyCleanupScheduler {
  private readonly logger = new Logger(MongoIdempotencyCleanupScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOperations(): Promise<number> {
    try {
      const result = await this.prisma.idempotencyOperation.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return result.count;
    } catch {
      this.logger.warn('Could not remove expired idempotency response snapshots');
      return 0;
    }
  }
}
