import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { FastifyReply } from 'fastify';
import { NotificationsService } from './notifications.service.js';
import { ClerkAuthGuard } from '@/common/guards/clerk-auth.guard.js';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import {
  notificationIdSchema,
  notificationListQuerySchema,
  type NotificationListQuery,
} from './in-app-notification.schema.js';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    @InjectPinoLogger(NotificationsController.name) private readonly logger: PinoLogger
  ) {}

  @Get('unsubscribe')
  @ApiOperation({ summary: 'Confirm opt-out from daily study reminder emails' })
  async confirmUnsubscribe(@Query('token') token: string, @Res() reply: FastifyReply) {
    if (!this.notifications.isUnsubscribeTokenValid(token ?? '')) {
      return reply.status(HttpStatus.BAD_REQUEST).type('text/html').send(unsubscribePage(false));
    }
    return reply.type('text/html').send(unsubscribePage(true, token));
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from daily study reminder emails' })
  @ApiResponse({ status: 200, description: 'Reminder preference disabled' })
  async unsubscribe(@Query('token') token: string, @Res() reply: FastifyReply) {
    await this.notifications.unsubscribe(token ?? '');
    this.logger.info('Daily reminder unsubscribe request accepted');
    return reply
      .type('text/html')
      .send(
        '<!doctype html><html><body><main><h1>Reminder emails disabled</h1><p>You will no longer receive daily PrepAI study reminders.</p></main></body></html>'
      );
  }

  @Get()
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the authenticated user in-app notifications' })
  async list(
    @CurrentUser('id') clerkUserId: string,
    @Query(new ZodValidationPipe(notificationListQuerySchema)) query: NotificationListQuery
  ) {
    const data = await this.notifications.listInAppNotifications(
      clerkUserId,
      query.cursor,
      query.limit
    );
    return { message: 'Notifications retrieved successfully', data };
  }

  @Get('unread-count')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user unread notification count' })
  async unreadCount(@CurrentUser('id') clerkUserId: string) {
    const count = await this.notifications.getUnreadNotificationCount(clerkUserId);
    return { data: { count } };
  }

  @Patch('read-all')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all authenticated user notifications as read' })
  async markAllRead(@CurrentUser('id') clerkUserId: string) {
    const updatedCount = await this.notifications.markAllInAppNotificationsRead(clerkUserId);
    return { message: 'Notifications marked as read', data: { updatedCount } };
  }

  @Patch(':id/read')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one authenticated user notification as read' })
  async markRead(
    @Param('id', new ZodValidationPipe(notificationIdSchema)) notificationId: string,
    @CurrentUser('id') clerkUserId: string
  ) {
    const data = await this.notifications.markInAppNotificationRead(clerkUserId, notificationId);
    return { message: 'Notification marked as read', data };
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete one authenticated user notification' })
  async deleteNotification(
    @Param('id', new ZodValidationPipe(notificationIdSchema)) notificationId: string,
    @CurrentUser('id') clerkUserId: string
  ) {
    await this.notifications.deleteInAppNotification(clerkUserId, notificationId);
    return { message: 'Notification deleted', data: null };
  }
}

function unsubscribePage(valid: boolean, token = ''): string {
  if (!valid) {
    return '<!doctype html><html><body><main><h1>Link unavailable</h1><p>This unsubscribe link is invalid or expired.</p></main></body></html>';
  }
  return `<!doctype html><html><body><main><h1>Daily study reminders</h1><p>Confirm that you want to stop daily reminder emails.</p><form method="post" action="/api/v1/notifications/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form></main></body></html>`;
}
