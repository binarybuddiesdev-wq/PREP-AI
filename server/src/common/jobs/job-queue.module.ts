import { Module } from '@nestjs/common';
import { JobQueueService } from './job-queue.service.js';

@Module({
  providers: [JobQueueService],
  exports: [JobQueueService],
})
export class JobQueueModule {}
