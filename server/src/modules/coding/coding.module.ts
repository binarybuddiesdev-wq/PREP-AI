import { Module } from '@nestjs/common';
import { CodingController } from './coding.controller.js';
import { CodingService } from './coding.service.js';
import { PistonClient } from './piston.client.js';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { CodingExecutionWorker } from './coding-execution.worker.js';
import { CodingExecutionService } from './coding-execution.service.js';
import { CodingReviewService } from './coding-review.service.js';
import { CodingReviewWorker } from './coding-review.worker.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { TheoryModule } from '../theory/theory.module.js';

@Module({
  imports: [JobQueueModule, MetricsModule, TheoryModule],
  controllers: [CodingController],
  providers: [
    CodingService,
    PistonClient,
    CodingExecutionService,
    CodingExecutionWorker,
    CodingReviewService,
    CodingReviewWorker,
  ],
})
export class CodingModule {}
