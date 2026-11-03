import { describe, expect, it } from 'vitest';
import { createQuestionFingerprint } from './question-fingerprint.js';

describe('createQuestionFingerprint', () => {
  it('hashes the exact topic, difficulty, and question tuple to a fixed-length key', () => {
    expect(
      createQuestionFingerprint({
        topicId: 'topic_001',
        difficulty: 'Junior',
        question: 'What is JSX?',
      })
    ).toBe('d306339134574940b3b84b0148e4632dea426c98cc72d1596fd3e077f4142e45');
  });

  it('keeps uniqueness scoped to the exact text, topic, and difficulty', () => {
    const input = { topicId: 'topic_001', difficulty: 'Junior', question: 'What is JSX?' };

    expect(createQuestionFingerprint({ ...input, question: 'what is JSX?' })).not.toBe(
      createQuestionFingerprint(input)
    );
    expect(createQuestionFingerprint({ ...input, topicId: 'topic_002' })).not.toBe(
      createQuestionFingerprint(input)
    );
    expect(createQuestionFingerprint({ ...input, difficulty: 'Mid' })).not.toBe(
      createQuestionFingerprint(input)
    );
  });

  it('canonicalizes Mongo ObjectId casing for the same topic', () => {
    expect(
      createQuestionFingerprint({
        topicId: 'ABCDEF0123456789ABCDEF01',
        difficulty: 'Junior',
        question: 'What is JSX?',
      })
    ).toBe(
      createQuestionFingerprint({
        topicId: 'abcdef0123456789abcdef01',
        difficulty: 'Junior',
        question: 'What is JSX?',
      })
    );
  });
});
