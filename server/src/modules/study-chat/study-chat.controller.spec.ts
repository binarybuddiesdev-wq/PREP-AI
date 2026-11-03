import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyChatController } from './study-chat.controller.js';
import { StudyChatService } from './study-chat.service.js';
import { ClerkAuthGuard } from '@/common/guards/clerk-auth.guard.js';

describe('StudyChatController', () => {
  let studyChat: {
    createConversation: ReturnType<typeof vi.fn>;
    listConversations: ReturnType<typeof vi.fn>;
    getConversation: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    deleteConversation: ReturnType<typeof vi.fn>;
  };
  let controller: StudyChatController;

  beforeEach(() => {
    studyChat = {
      createConversation: vi.fn().mockResolvedValue({ id: 'conversation-1' }),
      listConversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getConversation: vi.fn().mockResolvedValue({ id: 'conversation-1', messages: [] }),
      sendMessage: vi.fn().mockResolvedValue({ id: 'conversation-1', turnCount: 2 }),
      deleteConversation: vi.fn().mockResolvedValue(undefined),
    };
    controller = new StudyChatController(studyChat as unknown as StudyChatService);
  });

  it('creates and lists conversations for the signed-in Clerk subject', async () => {
    await expect(controller.create('clerk-user-1', { message: 'Explain arrays' })).resolves.toEqual(
      {
        message: 'Conversation created',
        data: { id: 'conversation-1' },
      }
    );
    await controller.list('clerk-user-1', { cursor: undefined, limit: 20 });

    expect(studyChat.createConversation).toHaveBeenCalledWith('clerk-user-1', 'Explain arrays');
    expect(studyChat.listConversations).toHaveBeenCalledWith('clerk-user-1', undefined, 20);
  });

  it('gets, continues, and deletes the conversation using the route ID and actor', async () => {
    await controller.get('507f1f77bcf86cd799439011', 'clerk-user-1');
    await controller.sendMessage('507f1f77bcf86cd799439011', 'clerk-user-1', {
      message: 'What is the complexity?',
    });
    await controller.delete('507f1f77bcf86cd799439011', 'clerk-user-1');

    expect(studyChat.getConversation).toHaveBeenCalledWith(
      'clerk-user-1',
      '507f1f77bcf86cd799439011'
    );
    expect(studyChat.sendMessage).toHaveBeenCalledWith(
      'clerk-user-1',
      '507f1f77bcf86cd799439011',
      'What is the complexity?'
    );
    expect(studyChat.deleteConversation).toHaveBeenCalledWith(
      'clerk-user-1',
      '507f1f77bcf86cd799439011'
    );
  });

  it('requires Clerk authentication for the entire conversation controller', () => {
    expect(Reflect.getMetadata('__guards__', StudyChatController)).toContain(ClerkAuthGuard);
  });
});
