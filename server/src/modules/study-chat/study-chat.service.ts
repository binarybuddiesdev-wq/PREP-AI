import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service.js';
import { StudyChatModelService } from './study-chat-model.service.js';
import {
  STUDY_CHAT_CONTEXT_MESSAGES,
  STUDY_CHAT_MAX_INPUT_CHARACTERS,
  STUDY_CHAT_MAX_OUTPUT_CHARACTERS,
  STUDY_CHAT_MAX_TRANSCRIPT_MESSAGES,
  STUDY_CHAT_MAX_TURNS,
} from './study-chat.types.js';
import type {
  StudyChatConversationView,
  StudyChatMessage,
  StudyChatPromptMessage,
} from './study-chat.types.js';

@Injectable()
export class StudyChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly model: StudyChatModelService,
    @InjectPinoLogger(StudyChatService.name) private readonly logger: PinoLogger
  ) {}

  async createConversation(clerkUserId: string, rawMessage: string) {
    const userId = await this.resolveUserId(clerkUserId);
    const message = this.validateMessage(rawMessage);
    const assistantMessage = await this.generateReply(clerkUserId, [
      { role: 'user', content: message },
    ]);
    const now = new Date();
    const messages: StudyChatMessage[] = [
      { role: 'user' as const, content: message, createdAt: now.toISOString() },
      {
        role: 'assistant' as const,
        content: assistantMessage,
        createdAt: new Date().toISOString(),
      },
    ];
    const conversation = await this.prisma.studyChatConversation.create({
      data: {
        userId,
        title: message.slice(0, 80),
        messages: messages as unknown as Prisma.InputJsonArray,
        turnCount: 1,
        revision: 0,
      },
    });
    return this.toConversationView(conversation);
  }

  async listConversations(clerkUserId: string, cursor?: string, limit = 20) {
    const userId = await this.resolveUserId(clerkUserId);
    if (cursor) {
      const cursorConversation = await this.prisma.studyChatConversation.findFirst({
        where: { id: cursor, userId },
        select: { id: true },
      });
      if (!cursorConversation) throw new BadRequestException('Invalid conversation cursor');
    }
    const rows = await this.prisma.studyChatConversation.findMany({
      where: { userId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, turnCount: true, createdAt: true, updatedAt: true },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      id: row.id,
      title: row.title,
      turnCount: row.turnCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  async getConversation(clerkUserId: string, conversationId: string) {
    const userId = await this.resolveUserId(clerkUserId);
    const conversation = await this.prisma.studyChatConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return this.toConversationView(conversation);
  }

  async sendMessage(clerkUserId: string, conversationId: string, rawMessage: string) {
    const userId = await this.resolveUserId(clerkUserId);
    const message = this.validateMessage(rawMessage);
    const conversation = await this.prisma.studyChatConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.turnCount >= STUDY_CHAT_MAX_TURNS) {
      throw new ConflictException('Conversation turn limit reached; start a new conversation');
    }

    const currentMessages = normalizeMessages(conversation.messages);
    const prompt: StudyChatPromptMessage[] = [
      ...currentMessages.slice(-STUDY_CHAT_CONTEXT_MESSAGES + 1).map(({ role, content }) => ({
        role: role as StudyChatMessage['role'],
        content,
      })),
      { role: 'user', content: message },
    ];
    const assistantMessage = await this.generateReply(clerkUserId, prompt);
    const now = new Date();
    const appendedMessages: StudyChatMessage[] = [
      ...currentMessages,
      { role: 'user' as const, content: message, createdAt: now.toISOString() },
      {
        role: 'assistant' as const,
        content: assistantMessage,
        createdAt: new Date().toISOString(),
      },
    ].slice(-STUDY_CHAT_MAX_TRANSCRIPT_MESSAGES);
    const result = await this.prisma.studyChatConversation.updateMany({
      where: { id: conversationId, userId, revision: conversation.revision },
      data: {
        messages: appendedMessages as unknown as Prisma.InputJsonArray,
        turnCount: { increment: 1 },
        revision: { increment: 1 },
      },
    });
    if (!result.count) {
      throw new ConflictException(
        'Conversation changed while generating a reply; retry your message'
      );
    }
    return this.toConversationView({
      ...conversation,
      messages: appendedMessages as unknown as Prisma.JsonValue,
      turnCount: conversation.turnCount + 1,
      updatedAt: now,
    });
  }

  async deleteConversation(clerkUserId: string, conversationId: string): Promise<void> {
    const userId = await this.resolveUserId(clerkUserId);
    const result = await this.prisma.studyChatConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    if (!result.count) throw new NotFoundException('Conversation not found');
  }

  private async resolveUserId(clerkUserId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  private validateMessage(rawMessage: string): string {
    const message = rawMessage.trim();
    if (!message || message.length > STUDY_CHAT_MAX_INPUT_CHARACTERS) {
      throw new BadRequestException('Message must contain between 1 and 4000 characters');
    }
    return message;
  }

  private async generateReply(
    clerkUserId: string,
    messages: StudyChatPromptMessage[]
  ): Promise<string> {
    try {
      const reply = await this.model.generateReply(clerkUserId, messages);
      return reply.slice(0, STUDY_CHAT_MAX_OUTPUT_CHARACTERS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error({ err: error }, 'Study chat provider request failed');
      throw new ServiceUnavailableException('Study chat is temporarily unavailable', {
        cause: error,
      });
    }
  }

  private toConversationView(conversation: {
    id: string;
    title: string;
    messages: Prisma.JsonValue;
    turnCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): StudyChatConversationView {
    return {
      id: conversation.id,
      title: conversation.title,
      messages: normalizeMessages(conversation.messages),
      turnCount: conversation.turnCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}

function normalizeMessages(value: Prisma.JsonValue): StudyChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StudyChatMessage[] => {
    if (
      typeof item !== 'object' ||
      item === null ||
      !('role' in item) ||
      !('content' in item) ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.content !== 'string'
    ) {
      return [];
    }
    return [
      {
        role: item.role,
        content: item.content,
        createdAt:
          'createdAt' in item && typeof item.createdAt === 'string'
            ? item.createdAt
            : new Date(0).toISOString(),
      },
    ];
  });
}
