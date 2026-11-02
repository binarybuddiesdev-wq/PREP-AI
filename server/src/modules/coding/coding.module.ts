import { Module } from '@nestjs/common';
import { CodingController } from './coding.controller.js';
import { CodingService } from './coding.service.js';
import { PistonClient } from './piston.client.js';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { CodingExecutionWorker } from './coding-execution.worker.js';
import { CodingExecutionService } from './coding-execution.service.js';

@Module({
  imports: [JobQueueModule],
  controllers: [CodingController],
  providers: [CodingService, PistonClient, CodingExecutionService, CodingExecutionWorker],
})
export class CodingModule {}
