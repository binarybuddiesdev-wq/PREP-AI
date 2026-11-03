import { createHash } from 'node:crypto';
import { requireIdempotencyKey } from '@/common/idempotency/index.js';

export function createStudyChatConversationId(clerkUserId: string, idempotencyKey: string): string {
  const key = requireIdempotencyKey(idempotencyKey);
  return createHash('sha256')
    .update(JSON.stringify([clerkUserId, 'study-chat:create', key]))
    .digest('hex')
    .slice(0, 24);
}
