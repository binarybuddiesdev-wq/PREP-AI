import { Module } from '@nestjs/common';
import { TheoryService } from './theory.service.js';
import { TheoryController } from './theory.controller.js';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';
import { TheoryEvaluationWorker } from './theory-evaluation.worker.js';
import { TheoryAiTokenBudgetService } from './theory-ai-token-budget.service.js';
import { MetricsModule } from '../metrics/metrics.module.js';

@Module({
  imports: [JobQueueModule, MetricsModule],
  providers: [
    TheoryService,
    TheoryEvaluationService,
    TheoryEvaluationWorker,
    TheoryAiTokenBudgetService,
  ],
  controllers: [TheoryController],
  exports: [TheoryAiTokenBudgetService],
})
export class TheoryModule {}
