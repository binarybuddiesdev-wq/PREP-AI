import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyChatService } from './study-chat.service.js';
import { StudyChatModelService } from './study-chat-model.service.js';
import { StudyChatIdempotencyService } from './study-chat-idempotency.service.js';
import { createStudyChatConversationId } from './study-chat-idempotency.js';
import { createIdempotencyRequestFingerprint } from '@/common/idempotency/index.js';

type StoredTestMessage = {
  role: string;
  content: string;
  createdAt: string;
  operationId?: string;
  requestFingerprint?: string;
};

describe('StudyChatService', () => {
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    studyChatConversation: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
  let model: { generateReply: ReturnType<typeof vi.fn> };
  let idempotency: {
    claim: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    renew: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    deleteForConversation: ReturnType<typeof vi.fn>;
  };
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let service: StudyChatService;

  const existingConversation = () => ({
    id: '507f1f77bcf86cd799439011',
    userId: 'db-user-1',
    title: 'Explain binary search',
    messages: [
      {
        role: 'user',
        content: 'Explain binary search',
        createdAt: '2026-11-03T10:00:00.000Z',
      },
      {
        role: 'assistant',
        content: 'It searches sorted data.',
        createdAt: '2026-11-03T10:00:01.000Z',
      },
    ] as StoredTestMessage[],
    turnCount: 1,
    revision: 1,
    createdAt: new Date('2026-11-03T10:00:00.000Z'),
    updatedAt: new Date('2026-11-03T10:00:01.000Z'),
  });

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'db-user-1' }) },
      studyChatConversation: {
        create: vi.fn().mockImplementation(({ data }) => ({
          ...data,
          id: data.id ?? '507f1f77bcf86cd799439011',
          createdAt: new Date('2026-11-03T10:00:00.000Z'),
          updatedAt: new Date('2026-11-03T10:00:01.000Z'),
        })),
        findFirst: vi
          .fn()
          .mockImplementation(({ where }) =>
            where.id === existingConversation().id ? existingConversation() : null
          ),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    model = { generateReply: vi.fn().mockResolvedValue('Here is a clear explanation.') };
    idempotency = {
      claim: vi.fn().mockResolvedValue({
        kind: 'claimed',
        claim: { userId: 'db-user-1', operationId: 'operation-1', leaseToken: 'lease-token-1' },
      }),
      complete: vi.fn().mockResolvedValue(undefined),
      renew: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      deleteForConversation: vi.fn().mockResolvedValue(undefined),
    };
    logger = { error: vi.fn(), warn: vi.fn() };
    service = new StudyChatService(
      prisma as never,
      model as unknown as StudyChatModelService,
      idempotency as unknown as StudyChatIdempotencyService,
      logger as never
    );
  });

  it('creates a conversation and returns a safe public representation', async () => {
    const result = await service.createConversation(
      'clerk-user-1',
      '  Explain binary search  ',
      'create-key-1'
    );

    expect(model.generateReply).toHaveBeenCalledWith(
      'clerk-user-1',
      [{ role: 'user', content: 'Explain binary search' }],
      expect.any(AbortSignal)
    );
    expect(idempotency.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: 'clerk-user-1',
        userId: 'db-user-1',
        scope: 'study-chat:create',
        key: 'create-key-1',
        conversationId: createStudyChatConversationId('clerk-user-1', 'create-key-1'),
      })
    );
    expect(prisma.studyChatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: createStudyChatConversationId('clerk-user-1', 'create-key-1'),
        userId: 'db-user-1',
        title: 'Explain binary search',
        turnCount: 1,
        revision: 0,
      }),
    });
    expect(result).toMatchObject({
      id: createStudyChatConversationId('clerk-user-1', 'create-key-1'),
      turnCount: 1,
    });
    expect(idempotency.complete).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-1', leaseToken: 'lease-token-1' }),
      expect.objectContaining({ turnCount: 1 })
    );
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('revision');
  });

  it('does not create a partial conversation when the model call fails', async () => {
    model.generateReply.mockRejectedValueOnce(new Error('provider details'));

    await expect(
      service.createConversation('clerk-user-1', 'Help me study', 'create-key-2')
    ).rejects.toThrow('Study chat is temporarily unavailable');
    expect(prisma.studyChatConversation.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(idempotency.release).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-1', leaseToken: 'lease-token-1' })
    );
  });

  it('renews an in-flight create claim before its original lease can expire', async () => {
    vi.useFakeTimers();
    let resolveModel!: (reply: string) => void;
    model.generateReply.mockImplementationOnce(
      () => new Promise<string>((resolve) => (resolveModel = resolve))
    );

    try {
      const pending = service.createConversation(
        'clerk-user-1',
        'Help me study',
        'create-key-slow'
      );
      for (let index = 0; index < 10 && !model.generateReply.mock.calls.length; index += 1) {
        await Promise.resolve();
      }
      expect(model.generateReply).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(60_000);
      expect(idempotency.renew).toHaveBeenCalledOnce();

      resolveModel('Here is a clear explanation.');
      await expect(pending).resolves.toMatchObject({ turnCount: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts model generation if the operation lease can no longer be renewed', async () => {
    vi.useFakeTimers();
    idempotency.renew.mockRejectedValueOnce(new Error('lease ownership lost'));
    model.generateReply.mockImplementationOnce(
      (_user: string, _messages: unknown, signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        })
    );

    try {
      const pending = service.createConversation(
        'clerk-user-1',
        'Help me study',
        'create-key-lease-lost'
      );
      for (let index = 0; index < 10 && !model.generateReply.mock.calls.length; index += 1) {
        await Promise.resolve();
      }
      const rejection = expect(pending).rejects.toThrow(
        'Study Chat operation lease was lost; retry with the same key'
      );

      await vi.advanceTimersByTimeAsync(60_000);
      await rejection;
      expect(idempotency.release).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('replays a matching create without calling the model or writing another conversation', async () => {
    const response = {
      id: createStudyChatConversationId('clerk-user-1', 'retry-key'),
      title: 'Help me study',
      messages: [
        { role: 'user', content: 'Help me study', createdAt: '2026-11-03T10:00:00.000Z' },
        { role: 'assistant', content: 'Here is a plan.', createdAt: '2026-11-03T10:00:01.000Z' },
      ],
      turnCount: 1,
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:01.000Z',
    };
    idempotency.claim.mockResolvedValueOnce({ kind: 'replay', response });

    const result = await service.createConversation('clerk-user-1', 'Help me study', 'retry-key');

    expect(result).toMatchObject({ id: response.id, title: response.title, turnCount: 1 });
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(prisma.studyChatConversation.create).not.toHaveBeenCalled();
    expect(idempotency.complete).not.toHaveBeenCalled();
  });

  it('recovers a matching conversation after a concurrent deterministic insert wins', async () => {
    const conversationId = createStudyChatConversationId('clerk-user-1', 'create-key-race');
    const recovered = {
      ...existingConversation(),
      id: conversationId,
      title: 'Help me study',
      messages: [
        {
          role: 'user',
          content: 'Help me study',
          createdAt: '2026-11-03T10:00:00.000Z',
          operationId: 'operation-1',
          requestFingerprint: createIdempotencyRequestFingerprint('study-chat:create', {
            message: 'Help me study',
          }),
        },
        {
          role: 'assistant',
          content: 'Here is a clear explanation.',
          createdAt: '2026-11-03T10:00:01.000Z',
        },
      ],
      turnCount: 1,
    };
    prisma.studyChatConversation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(recovered);
    prisma.studyChatConversation.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      service.createConversation('clerk-user-1', 'Help me study', 'create-key-race')
    ).resolves.toMatchObject({ id: conversationId, turnCount: 1 });
    expect(idempotency.complete).toHaveBeenCalledOnce();
    expect(idempotency.release).not.toHaveBeenCalled();
  });

  it('recovers a committed conversation when a create claim was left unfinished', async () => {
    const conversationId = createStudyChatConversationId('clerk-user-1', 'create-key-expired');
    const requestFingerprint = createIdempotencyRequestFingerprint('study-chat:create', {
      message: 'Help me study',
    });
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce({
      ...existingConversation(),
      id: conversationId,
      title: 'Help me study',
      messages: [
        {
          role: 'user',
          content: 'Help me study',
          createdAt: '2026-11-03T10:00:00.000Z',
          operationId: 'operation-1',
          requestFingerprint,
        },
        {
          role: 'assistant',
          content: 'Here is a clear explanation.',
          createdAt: '2026-11-03T10:00:01.000Z',
        },
      ],
      turnCount: 1,
    });

    const result = await service.createConversation(
      'clerk-user-1',
      'Help me study',
      'create-key-expired'
    );

    expect(result).toMatchObject({ id: conversationId, turnCount: 1 });
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(prisma.studyChatConversation.create).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalledOnce();
  });

  it('rejects an oversized message before spending a model call', async () => {
    await expect(
      service.createConversation('clerk-user-1', 'x'.repeat(4_001), 'create-key-3')
    ).rejects.toThrow('Message must contain between 1 and 4000 characters');
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(prisma.studyChatConversation.create).not.toHaveBeenCalled();
  });

  it('limits conversation titles and stored assistant response length', async () => {
    const message = 'interview prep '.repeat(10);
    model.generateReply.mockResolvedValueOnce('a'.repeat(12_500));

    const result = await service.createConversation('clerk-user-1', message, 'create-key-4');

    expect(prisma.studyChatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: message.trim().slice(0, 80) }),
    });
    expect(result.messages[1]?.content).toHaveLength(12_000);
  });

  it("lists only the current user's conversations with bounded stable pagination", async () => {
    prisma.studyChatConversation.findMany.mockResolvedValueOnce([
      { id: 'newest' },
      { id: 'next' },
      { id: 'older' },
    ]);

    await expect(service.listConversations('clerk-user-1', undefined, 2)).resolves.toMatchObject({
      items: [{ id: 'newest' }, { id: 'next' }],
      nextCursor: 'next',
    });
    expect(prisma.studyChatConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'db-user-1' },
        take: 3,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      })
    );
  });

  it('rejects a cursor that belongs to another user', async () => {
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.listConversations('clerk-user-1', '507f1f77bcf86cd799439011', 20)
    ).rejects.toThrow('Invalid conversation cursor');
    expect(prisma.studyChatConversation.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 for conversations not owned by the current user', async () => {
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getConversation('clerk-user-1', '507f1f77bcf86cd799439011')
    ).rejects.toThrow('Conversation not found');
    expect(model.generateReply).not.toHaveBeenCalled();
  });

  it('returns a valid owned transcript and ignores malformed stored message entries', async () => {
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce({
      ...existingConversation(),
      messages: [null, { role: 'system', content: 'ignore' }, { role: 'user', content: 'hello' }],
    });

    const result = await service.getConversation('clerk-user-1', '507f1f77bcf86cd799439011');

    expect(result.messages).toEqual([
      { role: 'user', content: 'hello', createdAt: new Date(0).toISOString() },
    ]);
  });

  it('returns an empty transcript if stored messages are not an array', async () => {
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce({
      ...existingConversation(),
      messages: 'invalid' as never,
    });

    const result = await service.getConversation('clerk-user-1', '507f1f77bcf86cd799439011');

    expect(result.messages).toEqual([]);
  });

  it('sends only the latest twenty messages and appends complete turns with revision matching', async () => {
    const conversation = existingConversation();
    conversation.messages = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${index}`,
      createdAt: '2026-11-03T10:00:00.000Z',
    }));
    conversation.messages[0]!.operationId = 'older-operation';
    conversation.messages[0]!.requestFingerprint = 'older-fingerprint';
    conversation.turnCount = 12;
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce(conversation);

    const result = await service.sendMessage(
      'clerk-user-1',
      '507f1f77bcf86cd799439011',
      'What is its complexity?',
      'turn-key-1'
    );

    expect(model.generateReply).toHaveBeenCalledWith(
      'clerk-user-1',
      [
        ...conversation.messages.slice(-19).map(({ role, content }) => ({ role, content })),
        { role: 'user', content: 'What is its complexity?' },
      ],
      expect.any(AbortSignal)
    );
    expect(prisma.studyChatConversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: conversation.id, userId: 'db-user-1', revision: 1 },
        data: expect.objectContaining({
          turnCount: { increment: 1 },
          revision: { increment: 1 },
        }),
      })
    );
    expect(prisma.studyChatConversation.updateMany.mock.calls[0]?.[0].data.messages).toContainEqual(
      expect.objectContaining({ operationId: 'older-operation' })
    );
    expect(result.messages).toHaveLength(26);
    expect(result).not.toHaveProperty('revision');
    expect(result.messages.at(-2)).not.toHaveProperty('operationId');
    expect(idempotency.complete).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-1' }),
      expect.objectContaining({ turnCount: 13 })
    );
  });

  it('replays a matching message request without another model call or transcript update', async () => {
    const response = {
      id: '507f1f77bcf86cd799439011',
      title: 'Explain binary search',
      messages: existingConversation().messages,
      turnCount: 2,
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-03T10:00:01.000Z',
    };
    idempotency.claim.mockResolvedValueOnce({ kind: 'replay', response });

    const result = await service.sendMessage(
      'clerk-user-1',
      '507f1f77bcf86cd799439011',
      'What is the complexity?',
      'turn-retry'
    );

    expect(result).toMatchObject({ turnCount: 2 });
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(prisma.studyChatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('recovers a stored operation from the transcript after its lease expired', async () => {
    const conversationId = '507f1f77bcf86cd799439011';
    const fingerprint = createIdempotencyRequestFingerprint(
      `study-chat:message:${conversationId}`,
      { message: 'follow up' }
    );
    const conversation = existingConversation();
    conversation.messages.push({
      role: 'user',
      content: 'follow up',
      createdAt: '2026-11-03T10:01:00.000Z',
      operationId: 'operation-1',
      requestFingerprint: fingerprint,
    });
    conversation.messages.push({
      role: 'assistant',
      content: 'Here is a follow up.',
      createdAt: '2026-11-03T10:01:01.000Z',
    });
    conversation.turnCount = 2;
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce(conversation);

    const result = await service.sendMessage(
      'clerk-user-1',
      conversationId,
      'follow up',
      'turn-key-3'
    );

    expect(result.turnCount).toBe(2);
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalledOnce();
  });

  it('returns 409 for an unrelated concurrent turn and releases the claim', async () => {
    prisma.studyChatConversation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.sendMessage(
        'clerk-user-1',
        '507f1f77bcf86cd799439011',
        'What is its complexity?',
        'turn-lost-race'
      )
    ).rejects.toThrow('Conversation changed while generating a reply');
    expect(idempotency.release).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'operation-1' })
    );
  });

  it('does not call the model when the idempotency key was used with another message', async () => {
    idempotency.claim.mockRejectedValueOnce(
      new Error('Idempotency-Key was already used with a different request')
    );

    await expect(
      service.sendMessage(
        'clerk-user-1',
        '507f1f77bcf86cd799439011',
        'different content',
        'turn-reused'
      )
    ).rejects.toThrow('Idempotency-Key was already used with a different request');
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(prisma.studyChatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects turns after thirty without calling the model', async () => {
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce({
      ...existingConversation(),
      turnCount: 30,
    });

    await expect(
      service.sendMessage('clerk-user-1', '507f1f77bcf86cd799439011', 'one more', 'turn-key-2')
    ).rejects.toThrow('Conversation turn limit reached');
    expect(model.generateReply).not.toHaveBeenCalled();
  });

  it('rejects a concurrent update instead of overwriting a newer transcript', async () => {
    prisma.studyChatConversation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.sendMessage('clerk-user-1', '507f1f77bcf86cd799439011', 'follow up', 'turn-key-3')
    ).rejects.toThrow('Conversation changed while generating a reply');
  });

  it('deletes only an owned conversation and returns 404 for a foreign ID', async () => {
    await expect(
      service.deleteConversation('clerk-user-1', '507f1f77bcf86cd799439011')
    ).resolves.toBeUndefined();
    expect(prisma.studyChatConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: '507f1f77bcf86cd799439011', userId: 'db-user-1' },
    });
    expect(idempotency.deleteForConversation).toHaveBeenCalledWith(
      'db-user-1',
      '507f1f77bcf86cd799439011'
    );

    prisma.studyChatConversation.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.deleteConversation('clerk-user-1', '507f1f77bcf86cd799439011')
    ).rejects.toThrow('Conversation not found');
  });
});
