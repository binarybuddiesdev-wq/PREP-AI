import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { PrismaModule } from '@/prisma/prisma.module.js';
import { EmailReminderScheduler } from './email-reminder.scheduler.js';
import { EmailWorker } from './email.worker.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [PrismaModule, JobQueueModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: Resend,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        return apiKey ? new Resend(apiKey) : null;
      },
    },
    NotificationsService,
    EmailReminderScheduler,
    EmailWorker,
  ],
})
export class NotificationsModule {}
