import { createHash } from 'node:crypto';
import { requireIdempotencyKey } from '@/common/idempotency/index.js';

export function createPdfUploadSourceId(userId: string, idempotencyKey: string): string {
  const key = requireIdempotencyKey(idempotencyKey);
  return createHash('sha256')
    .update(JSON.stringify([userId, 'pdf-upload', key]))
    .digest('hex')
    .slice(0, 24);
}
