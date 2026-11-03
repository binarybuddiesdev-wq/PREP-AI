import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class EmailReminderScheduler {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    @InjectPinoLogger(EmailReminderScheduler.name) private readonly logger: PinoLogger
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleDueReminders(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    try {
      await this.notifications.enqueueDueDailyReminders();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to scan daily email reminders');
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredNotifications(): Promise<void> {
    if (!this.config.get<boolean>('JOBS_WORKER_ENABLED', true)) return;
    try {
      await this.notifications.cleanupExpiredInAppNotifications();
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to clean up expired in-app notifications');
    }
  }
}
