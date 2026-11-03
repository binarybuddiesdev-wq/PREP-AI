import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Resend } from 'resend';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { createUnsubscribeToken, verifyUnsubscribeToken } from './email-unsubscribe-token.js';
import { getLocalReminderDate, isReminderDue } from './email-reminder.schedule.js';
import type { EmailReminderJob } from './email.types.js';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobQueueService,
    private readonly config: ConfigService,
    @InjectPinoLogger(NotificationsService.name) private readonly logger: PinoLogger,
    @Inject(Resend) private readonly resend: Resend | null = null
  ) {}

  async enqueueDueDailyReminders(now = new Date()): Promise<number> {
    if (!this.isDeliveryConfigured()) return 0;
    const optedIn = await this.prisma.userSettings.findMany({
      where: { dailyReminderEnabled: true },
      select: { userId: true, dailyReminderEnabled: true, dailyReminderTime: true, timezone: true },
    });
    let enqueued = 0;
    for (const settings of optedIn) {
      try {
        const reminderTime = settings.dailyReminderTime ?? '19:00';
        const timezone = settings.timezone ?? 'UTC';
        if (!isReminderDue(now, reminderTime, timezone)) continue;
        const localDate = getLocalReminderDate(now, timezone);
        const job: EmailReminderJob = {
          idempotencyKey: `daily-reminder:${settings.userId}:${localDate}`,
          userId: settings.userId,
          localDate,
        };
        await this.jobs.enqueue(JOB_QUEUE_NAMES.EMAIL, job, 'daily-reminder');
        enqueued += 1;
      } catch (error) {
        this.logger.warn(
          { userId: settings.userId, err: error },
          'Failed to schedule a daily study reminder'
        );
      }
    }
    return enqueued;
  }

  async sendDailyReminder(userId: string, localDate: string): Promise<void> {
    if (!this.isDeliveryConfigured() || !this.resend) {
      throw new ServiceUnavailableException('Email delivery is not configured');
    }
    const parsedLocalDate = new Date(`${localDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(localDate) ||
      Number.isNaN(parsedLocalDate.getTime()) ||
      parsedLocalDate.toISOString().slice(0, 10) !== localDate
    ) {
      throw new BadRequestException('Invalid reminder date');
    }
    const [settings, user] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    ]);
    const notifications = settings?.notifications;
    const emailEnabled =
      notifications !== null &&
      typeof notifications === 'object' &&
      !Array.isArray(notifications) &&
      (notifications as Record<string, unknown>)['email'] !== false;
    if (!settings?.dailyReminderEnabled || !emailEnabled || !user?.email) return;

    const unsubscribeUrl = this.createUnsubscribeUrl(userId);
    const safeName = escapeHtml(user.name || 'there');
    const result = await this.resend.emails.send(
      {
        from: this.config.get<string>('RESEND_FROM_EMAIL')!,
        to: user.email,
        subject: 'A quick PrepAI practice reminder',
        text: `Hi ${user.name || 'there'},\n\nReady for a little interview practice today? Open PrepAI when you have a few minutes.\n\nUnsubscribe: ${unsubscribeUrl}`,
        html: `<p>Hi ${safeName},</p><p>Ready for a little interview practice today? Open PrepAI when you have a few minutes.</p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from daily reminders</a></p>`,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
      { idempotencyKey: `daily-reminder:${userId}:${localDate}` }
    );
    if (result.error) throw new Error('Email provider rejected the reminder');
  }

  async unsubscribe(token: string): Promise<void> {
    const secret = this.config.get<string>('EMAIL_UNSUBSCRIBE_SECRET');
    const userId = secret ? verifyUnsubscribeToken(token, secret) : null;
    if (!userId) throw new BadRequestException('Invalid unsubscribe token');
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) return;
    const notifications = settings.notifications;
    const updatedNotifications =
      notifications !== null && typeof notifications === 'object' && !Array.isArray(notifications)
        ? { ...(notifications as Record<string, unknown>), dailyReminder: false }
        : { dailyReminder: false };
    await this.prisma.userSettings.updateMany({
      where: { userId },
      data: { dailyReminderEnabled: false, notifications: updatedNotifications },
    });
  }

  isUnsubscribeTokenValid(token: string): boolean {
    const secret = this.config.get<string>('EMAIL_UNSUBSCRIBE_SECRET');
    return Boolean(secret && verifyUnsubscribeToken(token, secret));
  }

  private isDeliveryConfigured(): boolean {
    return Boolean(
      this.config.get<string>('RESEND_API_KEY') &&
      this.config.get<string>('RESEND_FROM_EMAIL') &&
      this.config.get<string>('EMAIL_UNSUBSCRIBE_SECRET') &&
      this.config.get<string>('API_BASE_URL')
    );
  }

  private createUnsubscribeUrl(userId: string): string {
    const secret = this.config.get<string>('EMAIL_UNSUBSCRIBE_SECRET')!;
    const baseUrl = this.config.get<string>('API_BASE_URL')!;
    const token = createUnsubscribeToken(userId, secret);
    return `${baseUrl.replace(/\/$/, '')}/api/v1/notifications/unsubscribe?token=${encodeURIComponent(token)}`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });
}
