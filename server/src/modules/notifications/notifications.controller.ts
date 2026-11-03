import { Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { FastifyReply } from 'fastify';
import { NotificationsService } from './notifications.service.js';

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
}

function unsubscribePage(valid: boolean, token = ''): string {
  if (!valid) {
    return '<!doctype html><html><body><main><h1>Link unavailable</h1><p>This unsubscribe link is invalid or expired.</p></main></body></html>';
  }
  return `<!doctype html><html><body><main><h1>Daily study reminders</h1><p>Confirm that you want to stop daily reminder emails.</p><form method="post" action="/api/v1/notifications/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form></main></body></html>`;
}
