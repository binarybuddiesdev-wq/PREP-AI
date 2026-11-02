import { Module } from '@nestjs/common';
import { TheoryService } from './theory.service.js';
import { TheoryController } from './theory.controller.js';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { TheoryEvaluationService } from './theory-evaluation.service.js';
import { TheoryEvaluationWorker } from './theory-evaluation.worker.js';

@Module({
  imports: [JobQueueModule],
  providers: [TheoryService, TheoryEvaluationService, TheoryEvaluationWorker],
  controllers: [TheoryController],
})
export class TheoryModule {}
