import { Module } from '@nestjs/common';
import { MetricsModule } from '@/modules/metrics/metrics.module.js';
import { TheoryModule } from '@/modules/theory/theory.module.js';
import { PrismaModule } from '@/prisma/prisma.module.js';
import { mastra } from '@/mastra/mastra.config.js';
import { StudyChatController } from './study-chat.controller.js';
import { StudyChatIdempotencyService } from './study-chat-idempotency.service.js';
import { STUDY_COACH_AGENT, StudyChatModelService } from './study-chat-model.service.js';
import { StudyChatService } from './study-chat.service.js';

@Module({
  imports: [MetricsModule, PrismaModule, TheoryModule],
  controllers: [StudyChatController],
  providers: [
    {
      provide: STUDY_COACH_AGENT,
      useFactory: () => mastra.getAgent('studyCoachAgent'),
    },
    StudyChatModelService,
    StudyChatIdempotencyService,
    StudyChatService,
  ],
})
export class StudyChatModule {}
