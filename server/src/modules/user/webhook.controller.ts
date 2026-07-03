import { Controller, Post, Body, Headers, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Webhook } from 'svix';
import { UserService } from './user.service.js';
import { ClerkWebhookEventDto } from './dto/index.js';

@Controller('webhooks')
export class WebhookController {

    constructor(
        private readonly userService: UserService,
        @InjectPinoLogger(WebhookController.name) private readonly logger: PinoLogger,
    ) { }

    @Post('clerk')
    @HttpCode(HttpStatus.OK)
    async handleClerkWebhook(
        @Body() body: ClerkWebhookEventDto,
        @Headers('svix-id') svixId: string,
        @Headers('svix-timestamp') svixTimestamp: string,
        @Headers('svix-signature') svixSignature: string,
    ) {
        const secret = process.env['CLERK_WEBHOOK_SECRET'];
        if (!secret) {
            this.logger.error('CLERK_WEBHOOK_SECRET not configured');
            throw new BadRequestException('Webhook secret not configured');
        }

        if (!svixId || !svixTimestamp || !svixSignature) {
            this.logger.warn('Missing svix headers');
            throw new BadRequestException('Missing webhook headers');
        }

        const wh = new Webhook(secret);

        try {
            wh.verify(JSON.stringify(body), {
                'svix-id': svixId,
                'svix-timestamp': svixTimestamp,
                'svix-signature': svixSignature,
            });
        } catch (err) {
            this.logger.warn({ err }, 'Webhook signature verification failed');
            throw new BadRequestException('Invalid webhook signature');
        }

        const { type, data } = body;

        this.logger.info({ type, clerkUserId: data.id }, 'Processing Clerk webhook');

        switch (type) {
            case 'user.created': {
                const user = await this.userService.createUser(data);
                this.logger.info({ userId: user.id }, 'User created via webhook');
                return { received: true, userId: user.id };
            }
            case 'user.updated': {
                const user = await this.userService.updateUser(data.id, {
                    email: data.email_addresses?.[0]?.email_address,
                    name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(),
                    avatarUrl: data.image_url,
                });
                this.logger.info({ userId: user?.id }, 'User updated via webhook');
                return { received: true, userId: user?.id };
            }
            case 'user.deleted': {
                const user = await this.userService.deleteUser(data.id);
                this.logger.info({ userId: user?.id }, 'User deleted via webhook');
                return { received: true };
            }
            default: {
                this.logger.warn({ type }, 'Unhandled webhook event type');
                return { received: true, skipped: true };
            }
        }
    }
}
