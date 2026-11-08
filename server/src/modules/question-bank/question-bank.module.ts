import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module.js';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { MetricsModule } from '@/modules/metrics/metrics.module.js';
import { PistonClient } from '@/modules/coding/piston.client.js';
import { QuestionAssignmentService } from './question-assignment.service.js';
import { QuestionBankGeneratorService } from './question-bank-generator.service.js';
import { QuestionBankRepositoryService } from './question-bank-repository.service.js';
import { QuestionBankReplenishmentService } from './question-bank-replenishment.service.js';
import { QuestionBankScheduler } from './question-bank.scheduler.js';
import { QuestionBankWorker } from './question-bank.worker.js';

@Module({
  imports: [PrismaModule, JobQueueModule, MetricsModule],
  providers: [
    QuestionAssignmentService,
    QuestionBankGeneratorService,
    QuestionBankRepositoryService,
    QuestionBankReplenishmentService,
    QuestionBankScheduler,
    QuestionBankWorker,
    PistonClient,
  ],
  exports: [QuestionAssignmentService, QuestionBankReplenishmentService],
})
export class QuestionBankModule {}
