import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '@/common/guards/clerk-auth.guard.js';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe.js';
import { requireIdempotencyKey } from '@/common/idempotency/index.js';
import { StudyChatService } from './study-chat.service.js';
import {
  studyChatConversationIdSchema,
  studyChatListQuerySchema,
  studyChatMessageSchema,
} from './study-chat.schema.js';
import type { StudyChatListQuery, StudyChatMessageInput } from './study-chat.schema.js';

@ApiTags('Study Chat')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard)
@Controller('study-chat/conversations')
export class StudyChatController {
  constructor(private readonly studyChat: StudyChatService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 128 },
  })
  @ApiOperation({ summary: 'Start an interview study chat' })
  async create(
    @CurrentUser('id') clerkUserId: string,
    @Body(new ZodValidationPipe(studyChatMessageSchema)) body: StudyChatMessageInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    const key = requireIdempotencyKey(idempotencyKey);
    const data = await this.studyChat.createConversation(clerkUserId, body.message, key);
    return { message: 'Conversation created', data };
  }

  @Get()
  @ApiOperation({ summary: 'List the authenticated user conversations' })
  async list(
    @CurrentUser('id') clerkUserId: string,
    @Query(new ZodValidationPipe(studyChatListQuerySchema)) query: StudyChatListQuery
  ) {
    const data = await this.studyChat.listConversations(clerkUserId, query.cursor, query.limit);
    return { message: 'Conversations retrieved successfully', data };
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get an owned study chat transcript' })
  async get(
    @Param('conversationId', new ZodValidationPipe(studyChatConversationIdSchema))
    conversationId: string,
    @CurrentUser('id') clerkUserId: string
  ) {
    const data = await this.studyChat.getConversation(clerkUserId, conversationId);
    return { message: 'Conversation retrieved successfully', data };
  }

  @Post(':conversationId/messages')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', minLength: 1, maxLength: 128 },
  })
  @ApiOperation({ summary: 'Send a message in an owned study chat' })
  async sendMessage(
    @Param('conversationId', new ZodValidationPipe(studyChatConversationIdSchema))
    conversationId: string,
    @CurrentUser('id') clerkUserId: string,
    @Body(new ZodValidationPipe(studyChatMessageSchema)) body: StudyChatMessageInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    const key = requireIdempotencyKey(idempotencyKey);
    const data = await this.studyChat.sendMessage(clerkUserId, conversationId, body.message, key);
    return { message: 'Study chat reply created', data };
  }

  @Delete(':conversationId')
  @ApiOperation({ summary: 'Delete an owned study chat conversation' })
  async delete(
    @Param('conversationId', new ZodValidationPipe(studyChatConversationIdSchema))
    conversationId: string,
    @CurrentUser('id') clerkUserId: string
  ) {
    await this.studyChat.deleteConversation(clerkUserId, conversationId);
    return { message: 'Conversation deleted', data: null };
  }
}
