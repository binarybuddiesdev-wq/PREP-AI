import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module.js';
import { AuditLogRetentionScheduler } from './audit-log-retention.scheduler.js';
import { AuditLogService } from './audit-log.service.js';

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService, AuditLogRetentionScheduler],
  exports: [AuditLogService],
})
export class AuditModule {}
