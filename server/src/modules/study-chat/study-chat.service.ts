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
import { createIdempotencyRequestFingerprint } from '@/common/idempotency/index.js';
import { IDEMPOTENCY_KEY_REUSED } from '@/common/constants/api.constants.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { StudyChatIdempotencyService } from './study-chat-idempotency.service.js';
import { createStudyChatConversationId } from './study-chat-idempotency.js';
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

const STUDY_CHAT_LEASE_RENEW_INTERVAL_MS = 60 * 1_000;

@Injectable()
export class StudyChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly model: StudyChatModelService,
    private readonly idempotency: StudyChatIdempotencyService,
    @InjectPinoLogger(StudyChatService.name) private readonly logger: PinoLogger
  ) {}

  async createConversation(clerkUserId: string, rawMessage: string, idempotencyKey: string) {
    const userId = await this.resolveUserId(clerkUserId);
    const message = this.validateMessage(rawMessage);
    const scope = 'study-chat:create';
    const conversationId = createStudyChatConversationId(clerkUserId, idempotencyKey);
    const requestFingerprint = createIdempotencyRequestFingerprint(scope, { message });
    const operation = await this.idempotency.claim({
      clerkUserId,
      userId,
      scope,
      key: idempotencyKey,
      requestFingerprint,
      conversationId,
    });
    if (operation.kind === 'replay') return deserializeConversationView(operation.response);

    try {
      const persisted = await this.prisma.studyChatConversation.findFirst({
        where: { id: conversationId, userId },
      });
      if (persisted) {
        if (!hasOperation(persisted.messages, operation.claim.operationId, requestFingerprint)) {
          throw new ConflictException(IDEMPOTENCY_KEY_REUSED);
        }
        const recovered = this.toConversationView(persisted);
        await this.idempotency.complete(operation.claim, serializeConversationView(recovered));
        return recovered;
      }

      const assistantMessage = await this.generateReplyWithLease(
        clerkUserId,
        [{ role: 'user', content: message }],
        operation.claim
      );
      const now = new Date();
      const messages: StudyChatStoredMessage[] = [
        {
          role: 'user',
          content: message,
          createdAt: now.toISOString(),
          operationId: operation.claim.operationId,
          requestFingerprint,
        },
        { role: 'assistant', content: assistantMessage, createdAt: new Date().toISOString() },
      ];
      const conversation = await this.prisma.studyChatConversation.create({
        data: {
          id: conversationId,
          userId,
          title: message.slice(0, 80),
          messages: messages as unknown as Prisma.InputJsonArray,
          turnCount: 1,
          revision: 0,
        },
      });
      const view = this.toConversationView(conversation);
      await this.idempotency.complete(operation.claim, serializeConversationView(view));
      return view;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        try {
          const concurrent = await this.prisma.studyChatConversation.findFirst({
            where: { id: conversationId, userId },
          });
          if (
            concurrent &&
            hasOperation(concurrent.messages, operation.claim.operationId, requestFingerprint)
          ) {
            const recovered = this.toConversationView(concurrent);
            await this.idempotency.complete(operation.claim, serializeConversationView(recovered));
            return recovered;
          }
        } catch (recoveryError) {
          this.logger.warn(
            { err: recoveryError },
            'Could not recover concurrent Study Chat create'
          );
        }
      }
      await this.releaseClaim(operation.claim, error);
      throw error;
    }
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

  async sendMessage(
    clerkUserId: string,
    conversationId: string,
    rawMessage: string,
    idempotencyKey: string
  ) {
    const userId = await this.resolveUserId(clerkUserId);
    const message = this.validateMessage(rawMessage);
    const conversation = await this.prisma.studyChatConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const scope = `study-chat:message:${conversationId}`;
    const requestFingerprint = createIdempotencyRequestFingerprint(scope, { message });
    const operation = await this.idempotency.claim({
      clerkUserId,
      userId,
      scope,
      key: idempotencyKey,
      requestFingerprint,
      conversationId,
    });
    if (operation.kind === 'replay') return deserializeConversationView(operation.response);

    try {
      if (hasOperation(conversation.messages, operation.claim.operationId, requestFingerprint)) {
        const recovered = this.toConversationView(conversation);
        await this.idempotency.complete(operation.claim, serializeConversationView(recovered));
        return recovered;
      }
      if (conversation.turnCount >= STUDY_CHAT_MAX_TURNS) {
        throw new ConflictException('Conversation turn limit reached; start a new conversation');
      }

      const currentMessages = normalizeStoredMessages(conversation.messages);
      const prompt: StudyChatPromptMessage[] = [
        ...currentMessages.slice(-STUDY_CHAT_CONTEXT_MESSAGES + 1).map(({ role, content }) => ({
          role,
          content,
        })),
        { role: 'user', content: message },
      ];
      const assistantMessage = await this.generateReplyWithLease(
        clerkUserId,
        prompt,
        operation.claim
      );
      const now = new Date();
      const appendedMessages: StudyChatStoredMessage[] = [
        ...currentMessages,
        {
          role: 'user' as const,
          content: message,
          createdAt: now.toISOString(),
          operationId: operation.claim.operationId,
          requestFingerprint,
        },
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
        const latest = await this.prisma.studyChatConversation.findFirst({
          where: { id: conversationId, userId },
        });
        if (
          latest &&
          hasOperation(latest.messages, operation.claim.operationId, requestFingerprint)
        ) {
          const recovered = this.toConversationView(latest);
          await this.idempotency.complete(operation.claim, serializeConversationView(recovered));
          return recovered;
        }
        throw new ConflictException(
          'Conversation changed while generating a reply; retry your message'
        );
      }
      const view = this.toConversationView({
        ...conversation,
        messages: appendedMessages as unknown as Prisma.JsonValue,
        turnCount: conversation.turnCount + 1,
        updatedAt: now,
      });
      await this.idempotency.complete(operation.claim, serializeConversationView(view));
      return view;
    } catch (error) {
      await this.releaseClaim(operation.claim, error);
      throw error;
    }
  }

  async deleteConversation(clerkUserId: string, conversationId: string): Promise<void> {
    const userId = await this.resolveUserId(clerkUserId);
    const result = await this.prisma.studyChatConversation.deleteMany({
      where: { id: conversationId, userId },
    });
    await this.idempotency.deleteForConversation(userId, conversationId);
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
    messages: StudyChatPromptMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const reply = await this.model.generateReply(clerkUserId, messages, signal);
      return reply.slice(0, STUDY_CHAT_MAX_OUTPUT_CHARACTERS);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error({ err: error }, 'Study chat provider request failed');
      throw new ServiceUnavailableException('Study chat is temporarily unavailable', {
        cause: error,
      });
    }
  }

  private async generateReplyWithLease(
    clerkUserId: string,
    messages: StudyChatPromptMessage[],
    claim: { userId: string; operationId: string; leaseToken: string }
  ): Promise<string> {
    const controller = new AbortController();
    let renewalInFlight: Promise<void> | undefined;
    let renewalError: unknown;
    const timer = setInterval(() => {
      if (renewalInFlight) return;
      renewalInFlight = this.idempotency
        .renew(claim)
        .catch((error: unknown) => {
          renewalError = error;
          controller.abort(error);
          this.logger.warn({ err: error }, 'Could not renew Study Chat operation lease');
        })
        .finally(() => {
          renewalInFlight = undefined;
        });
    }, STUDY_CHAT_LEASE_RENEW_INTERVAL_MS);

    let reply: string | undefined;
    let generationError: unknown;
    try {
      reply = await this.generateReply(clerkUserId, messages, controller.signal);
    } catch (error) {
      generationError = error;
    } finally {
      clearInterval(timer);
      if (renewalInFlight) await renewalInFlight;
    }

    if (renewalError) {
      throw new ConflictException('Study Chat operation lease was lost; retry with the same key');
    }
    if (generationError) throw generationError;
    return reply!;
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

  private async releaseClaim(
    claim: { userId: string; operationId: string; leaseToken: string },
    originalError: unknown
  ): Promise<void> {
    try {
      await this.idempotency.release(claim);
    } catch (releaseError) {
      this.logger.warn(
        { err: releaseError, originalError },
        'Could not release failed Study Chat operation claim'
      );
    }
  }
}

interface StudyChatStoredMessage extends StudyChatMessage {
  operationId?: string;
  requestFingerprint?: string;
}

function hasOperation(value: Prisma.JsonValue, operationId: string, fingerprint: string): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'operationId' in item &&
        item.operationId === operationId &&
        'requestFingerprint' in item &&
        item.requestFingerprint === fingerprint
    )
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function serializeConversationView(view: StudyChatConversationView): Prisma.InputJsonValue {
  return {
    id: view.id,
    title: view.title,
    messages: view.messages.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
    turnCount: view.turnCount,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

function deserializeConversationView(value: Prisma.JsonValue): StudyChatConversationView {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !('id' in value) ||
    !('title' in value) ||
    !('turnCount' in value) ||
    !('createdAt' in value) ||
    !('updatedAt' in value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.turnCount !== 'number' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new ServiceUnavailableException('Saved Study Chat replay is invalid');
  }
  return {
    id: value.id,
    title: value.title,
    messages: normalizeMessages('messages' in value ? (value.messages ?? null) : null),
    turnCount: value.turnCount,
    createdAt: new Date(value.createdAt),
    updatedAt: new Date(value.updatedAt),
  };
}

function normalizeMessages(value: Prisma.JsonValue): StudyChatMessage[] {
  return normalizeStoredMessages(value).map(({ role, content, createdAt }) => ({
    role,
    content,
    createdAt,
  }));
}

function normalizeStoredMessages(value: Prisma.JsonValue): StudyChatStoredMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StudyChatStoredMessage[] => {
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
    const message: StudyChatStoredMessage = {
      role: item.role,
      content: item.content,
      createdAt:
        'createdAt' in item && typeof item.createdAt === 'string'
          ? item.createdAt
          : new Date(0).toISOString(),
    };
    if ('operationId' in item && typeof item.operationId === 'string') {
      message.operationId = item.operationId;
    }
    if ('requestFingerprint' in item && typeof item.requestFingerprint === 'string') {
      message.requestFingerprint = item.requestFingerprint;
    }
    return [message];
  });
}
