import { Module } from '@nestjs/common';
import { TechExpertController } from './tech-expert.controller.js';
import { TechExpertService } from './tech-expert.service.js';
import { MetricsModule } from '../metrics/metrics.module.js';

@Module({
  controllers: [TechExpertController],
  imports: [MetricsModule],
  providers: [TechExpertService],
})
export class TechExpertModule {}
