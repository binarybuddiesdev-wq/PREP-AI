import { Global, Module } from '@nestjs/common';
import { PrismaService, PrismaPostgresqlService } from './prisma.service.js';
import { MetricsModule } from '../modules/metrics/metrics.module.js';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [PrismaService, PrismaPostgresqlService],
  exports: [PrismaService, PrismaPostgresqlService],
})
export class PrismaModule {}
