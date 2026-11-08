import { Module } from '@nestjs/common';
import { TheoryService } from './theory.service.js';
import { TheoryController } from './theory.controller.js';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';
import { TheoryEvaluationWorker } from './theory-evaluation.worker.js';
import { TheoryAiTokenBudgetService } from './theory-ai-token-budget.service.js';
import { MetricsModule } from '../metrics/metrics.module.js';
import { QuestionBankModule } from '../question-bank/question-bank.module.js';

@Module({
  imports: [JobQueueModule, MetricsModule, QuestionBankModule],
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
