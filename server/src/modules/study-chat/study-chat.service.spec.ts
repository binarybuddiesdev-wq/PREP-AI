import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyChatService } from './study-chat.service.js';
import { StudyChatModelService } from './study-chat-model.service.js';

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
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let service: StudyChatService;

  const existingConversation = () => ({
    id: '507f1f77bcf86cd799439011',
    userId: 'db-user-1',
    title: 'Explain binary search',
    messages: [
      { role: 'user', content: 'Explain binary search', createdAt: '2026-11-03T10:00:00.000Z' },
      {
        role: 'assistant',
        content: 'It searches sorted data.',
        createdAt: '2026-11-03T10:00:01.000Z',
      },
    ],
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
          id: '507f1f77bcf86cd799439011',
          createdAt: new Date('2026-11-03T10:00:00.000Z'),
          updatedAt: new Date('2026-11-03T10:00:01.000Z'),
        })),
        findFirst: vi.fn().mockResolvedValue(existingConversation()),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    model = { generateReply: vi.fn().mockResolvedValue('Here is a clear explanation.') };
    logger = { error: vi.fn(), warn: vi.fn() };
    service = new StudyChatService(
      prisma as never,
      model as unknown as StudyChatModelService,
      logger as never
    );
  });

  it('creates a conversation and returns a safe public representation', async () => {
    const result = await service.createConversation('clerk-user-1', '  Explain binary search  ');

    expect(model.generateReply).toHaveBeenCalledWith('clerk-user-1', [
      { role: 'user', content: 'Explain binary search' },
    ]);
    expect(prisma.studyChatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'db-user-1',
        title: 'Explain binary search',
        turnCount: 1,
        revision: 0,
      }),
    });
    expect(result).toMatchObject({ id: '507f1f77bcf86cd799439011', turnCount: 1 });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('revision');
  });

  it('does not create a partial conversation when the model call fails', async () => {
    model.generateReply.mockRejectedValueOnce(new Error('provider details'));

    await expect(service.createConversation('clerk-user-1', 'Help me study')).rejects.toThrow(
      'Study chat is temporarily unavailable'
    );
    expect(prisma.studyChatConversation.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('rejects an oversized message before spending a model call', async () => {
    await expect(service.createConversation('clerk-user-1', 'x'.repeat(4_001))).rejects.toThrow(
      'Message must contain between 1 and 4000 characters'
    );
    expect(model.generateReply).not.toHaveBeenCalled();
    expect(prisma.studyChatConversation.create).not.toHaveBeenCalled();
  });

  it('limits conversation titles and stored assistant response length', async () => {
    const message = 'interview prep '.repeat(10);
    model.generateReply.mockResolvedValueOnce('a'.repeat(12_500));

    const result = await service.createConversation('clerk-user-1', message);

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
    conversation.turnCount = 12;
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce(conversation);

    const result = await service.sendMessage(
      'clerk-user-1',
      '507f1f77bcf86cd799439011',
      'What is its complexity?'
    );

    expect(model.generateReply).toHaveBeenCalledWith('clerk-user-1', [
      ...conversation.messages.slice(-19).map(({ role, content }) => ({ role, content })),
      { role: 'user', content: 'What is its complexity?' },
    ]);
    expect(prisma.studyChatConversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: conversation.id, userId: 'db-user-1', revision: 1 },
        data: expect.objectContaining({
          turnCount: { increment: 1 },
          revision: { increment: 1 },
        }),
      })
    );
    expect(result.messages).toHaveLength(26);
    expect(result).not.toHaveProperty('revision');
  });

  it('rejects turns after thirty without calling the model', async () => {
    prisma.studyChatConversation.findFirst.mockResolvedValueOnce({
      ...existingConversation(),
      turnCount: 30,
    });

    await expect(
      service.sendMessage('clerk-user-1', '507f1f77bcf86cd799439011', 'one more')
    ).rejects.toThrow('Conversation turn limit reached');
    expect(model.generateReply).not.toHaveBeenCalled();
  });

  it('rejects a concurrent update instead of overwriting a newer transcript', async () => {
    prisma.studyChatConversation.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.sendMessage('clerk-user-1', '507f1f77bcf86cd799439011', 'follow up')
    ).rejects.toThrow('Conversation changed while generating a reply');
  });

  it('deletes only an owned conversation and returns 404 for a foreign ID', async () => {
    await expect(
      service.deleteConversation('clerk-user-1', '507f1f77bcf86cd799439011')
    ).resolves.toBeUndefined();
    expect(prisma.studyChatConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: '507f1f77bcf86cd799439011', userId: 'db-user-1' },
    });

    prisma.studyChatConversation.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.deleteConversation('clerk-user-1', '507f1f77bcf86cd799439011')
    ).rejects.toThrow('Conversation not found');
  });
});
