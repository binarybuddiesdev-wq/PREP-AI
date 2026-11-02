import { createHash } from 'node:crypto';

export function createTheoryAnswerId(sessionId: string, idempotencyKey: string): string {
  const answerIdBytes = createHash('sha256')
    .update(JSON.stringify([sessionId, idempotencyKey]))
    .digest()
    .subarray(0, 16);
  answerIdBytes[6] = (answerIdBytes[6] & 0x0f) | 0x80;
  answerIdBytes[8] = (answerIdBytes[8] & 0x3f) | 0x80;

  const answerIdHex = answerIdBytes.toString('hex');
  return [
    answerIdHex.slice(0, 8),
    answerIdHex.slice(8, 12),
    answerIdHex.slice(12, 16),
    answerIdHex.slice(16, 20),
    answerIdHex.slice(20),
  ].join('-');
}
