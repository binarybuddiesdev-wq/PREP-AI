import { Module } from '@nestjs/common';
import { TopicService } from './topic.service.js';
import { TopicController } from './topic.controller.js';
import { MetricsModule } from '@/modules/metrics/metrics.module.js';

@Module({
  imports: [MetricsModule],
  providers: [TopicService],
  controllers: [TopicController],
})
export class TopicModule {}
