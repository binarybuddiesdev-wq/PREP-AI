import { describe, expect, it } from 'vitest';
import { notificationIdSchema, notificationListQuerySchema } from './in-app-notification.schema.js';

describe('in-app notification request schemas', () => {
  it('defaults the page size and caps it at fifty', () => {
    expect(notificationListQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(notificationListQuerySchema.parse({ limit: '50' })).toEqual({ limit: 50 });
    expect(notificationListQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });

  it('requires a valid Mongo ObjectId cursor and notification id', () => {
    expect(notificationListQuerySchema.safeParse({ cursor: 'invalid' }).success).toBe(false);
    expect(notificationIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
    expect(notificationIdSchema.safeParse('not-an-id').success).toBe(false);
  });
});
