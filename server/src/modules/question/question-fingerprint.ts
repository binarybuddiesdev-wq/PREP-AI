import { createHash } from 'node:crypto';

export interface IQuestionFingerprintInput {
  topicId: string;
  difficulty: string;
  question: string;
}

export function createQuestionFingerprint(input: IQuestionFingerprintInput): string {
  return createHash('sha256')
    .update(JSON.stringify([input.topicId.toLowerCase(), input.difficulty, input.question]))
    .digest('hex');
}
