import { describe, expect, it } from 'vitest';
import {
  studyChatConversationIdSchema,
  studyChatListQuerySchema,
  studyChatMessageSchema,
} from './study-chat.schema.js';

describe('study chat request schemas', () => {
  it('trims messages and enforces the 1 to 4000 character bounds', () => {
    expect(studyChatMessageSchema.parse({ message: '  explain arrays  ' })).toEqual({
      message: 'explain arrays',
    });
    expect(studyChatMessageSchema.safeParse({ message: '   ' }).success).toBe(false);
    expect(studyChatMessageSchema.safeParse({ message: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('defaults list pages to twenty and rejects invalid cursors and oversized limits', () => {
    expect(studyChatListQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(studyChatListQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(studyChatListQuerySchema.safeParse({ cursor: 'bad' }).success).toBe(false);
  });

  it('accepts only Mongo ObjectId conversation IDs', () => {
    expect(studyChatConversationIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
    expect(studyChatConversationIdSchema.safeParse('conversation-1').success).toBe(false);
  });
});
