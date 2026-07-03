import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { WebhookController } from './webhook.controller.js';
import { PrismaModule } from '@/prisma/prisma.module.js';

@Module({
    imports: [PrismaModule],
    providers: [UserService],
    controllers: [UserController, WebhookController],
    exports: [UserService],
})
export class UserModule { }
