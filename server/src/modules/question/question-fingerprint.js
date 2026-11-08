import { createHash } from 'node:crypto';
export function createQuestionFingerprint(input) {
  return createHash('sha256')
    .update(JSON.stringify([input.topicId.toLowerCase(), input.difficulty, input.question]))
    .digest('hex');
}
