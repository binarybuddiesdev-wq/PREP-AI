import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { RedisModule } from '../../common/redis/redis.module.js';

@Module({
  imports: [RedisModule],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: 'METRICS_BEARER_TOKEN',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<string>('app.metricsBearerToken'),
    },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
