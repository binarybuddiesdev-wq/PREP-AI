import { describe, expect, it } from 'vitest';
import { createStudyChatConversationId } from './study-chat-idempotency.js';

describe('createStudyChatConversationId', () => {
  it('returns a stable Mongo ObjectId for the same actor and creation key', () => {
    const first = createStudyChatConversationId('clerk-user-1', 'create-key-1');

    expect(createStudyChatConversationId('clerk-user-1', 'create-key-1')).toBe(first);
    expect(first).toMatch(/^[a-f\d]{24}$/);
  });

  it('uses a different Mongo ObjectId for a different actor or creation key', () => {
    const original = createStudyChatConversationId('clerk-user-1', 'create-key-1');

    expect(createStudyChatConversationId('clerk-user-2', 'create-key-1')).not.toBe(original);
    expect(createStudyChatConversationId('clerk-user-1', 'create-key-2')).not.toBe(original);
  });

  it('validates the idempotency key using the shared policy', () => {
    expect(() => createStudyChatConversationId('clerk-user-1', ' leading')).toThrow(
      'A valid Idempotency-Key header is required'
    );
  });
});
