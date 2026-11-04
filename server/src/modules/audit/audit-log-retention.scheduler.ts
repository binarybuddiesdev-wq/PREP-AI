import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';

@Injectable()
export class AuditLogRetentionScheduler {
  private readonly logger = new Logger(AuditLogRetentionScheduler.name);

  constructor(private readonly postgres: PrismaPostgresqlService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanup(): Promise<void> {
    const client = this.postgres.client_;
    if (!client) return;

    try {
      const result = await client.$queryRaw<Array<{ deleted_count: bigint }>>`
        SELECT public.prepai_prune_audit_log() AS deleted_count
      `;
      this.logger.log(
        { deletedCount: Number(result[0]?.deleted_count ?? 0) },
        'Audit log retention completed'
      );
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.name : 'UnknownError' },
        'Audit log retention failed'
      );
    }
  }
}
