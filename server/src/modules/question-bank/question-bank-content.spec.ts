import { describe, expect, it } from 'vitest';
import {
  createQuestionContentFingerprint,
  createQuestionConceptFingerprint,
  normalizeQuestionContent,
  validateTheoryQuestionBatch,
  validateCodingProblemBatch,
} from './question-bank-content.js';

describe('question content fingerprints', () => {
  it('normalizes case, whitespace, and punctuation so cosmetic rewrites collide', () => {
    expect(normalizeQuestionContent('  How   would you handle this?  ')).toBe(
      normalizeQuestionContent('how would you handle this')
    );
    expect(createQuestionContentFingerprint('React state?')).toBe(
      createQuestionContentFingerprint(' REACT   STATE! ')
    );
  });

  it('keeps distinct situations separate', () => {
    expect(createQuestionContentFingerprint('A cache is stale after writes')).not.toBe(
      createQuestionContentFingerprint('A queue retries a failed job')
    );
  });

  it('treats the same learning objective and scenario as a duplicate across rewrites', () => {
    expect(
      createQuestionConceptFingerprint({
        topic: 'React',
        difficulty: 'Junior',
        learningObjective: 'lift shared state',
        scenarioKey: 'two widgets share a counter',
      })
    ).toBe(
      createQuestionConceptFingerprint({
        topic: 'react',
        difficulty: 'Junior',
        learningObjective: 'Lift   shared state!',
        scenarioKey: 'Two widgets share a counter.',
      })
    );
  });

  it('keeps a learning objective and scenario unique across difficulty levels', () => {
    const fingerprint = createQuestionConceptFingerprint({
      topic: 'React',
      difficulty: 'Junior',
      learningObjective: 'state-lifting',
      scenarioKey: 'shared-counter',
    });
    expect(
      createQuestionConceptFingerprint({
        topic: 'React',
        difficulty: 'Senior',
        learningObjective: 'state-lifting',
        scenarioKey: 'shared-counter',
      })
    ).toBe(fingerprint);
  });

  it('rejects incomplete batches and repeated scenarios before persistence', () => {
    const question = {
      topicSlug: 'react',
      difficulty: 'Junior',
      learningObjective: 'state-lifting',
      scenarioKey: 'shared-counter',
      scenario: 'Two sibling widgets must keep a shared counter in sync after updates.',
      question: 'How would you structure their state and explain the trade-offs?',
      referenceAnswer:
        'Move the shared state to their closest common owner and pass values and callbacks down.',
    };

    expect(() =>
      validateTheoryQuestionBatch([question, question], {
        topicSlug: 'react',
        difficulty: 'Junior',
        count: 2,
      })
    ).toThrow(/duplicate/i);
    expect(() =>
      validateTheoryQuestionBatch([question], {
        topicSlug: 'react',
        difficulty: 'Junior',
        count: 2,
      })
    ).toThrow(/exactly 2/i);
  });

  it('rejects a batch item generated for a different topic or difficulty', () => {
    expect(() =>
      validateTheoryQuestionBatch(
        [
          {
            topicSlug: 'react',
            difficulty: 'Senior',
            learningObjective: 'state-lifting',
            scenarioKey: 'shared-counter',
            scenario: 'Two sibling widgets must keep a shared counter in sync after updates.',
            question: 'How would you structure their state and explain the trade-offs?',
            referenceAnswer:
              'Move the shared state to their closest common owner and pass values and callbacks down.',
          },
        ],
        { topicSlug: 'react', difficulty: 'Junior', count: 1 }
      )
    ).toThrow(/topic or difficulty/i);
  });

  it('rejects malformed items, previously seen prompts, and previously seen concepts', () => {
    const question = {
      topicSlug: 'react',
      difficulty: 'Junior',
      learningObjective: 'state-lifting',
      scenarioKey: 'shared-counter',
      scenario: 'Two sibling widgets must keep a shared counter in sync after updates.',
      question: 'How would you structure their state and explain the trade-offs?',
      referenceAnswer:
        'Move the shared state to their closest common owner and pass values and callbacks down.',
    };
    expect(() =>
      validateTheoryQuestionBatch([{}], { topicSlug: 'react', difficulty: 'Junior', count: 1 })
    ).toThrow(/invalid structure/i);
    expect(() =>
      validateTheoryQuestionBatch([question], {
        topicSlug: 'react',
        difficulty: 'Junior',
        count: 1,
        existingFingerprints: new Set([createQuestionContentFingerprint(question.question)]),
      })
    ).toThrow(/duplicate/i);
    expect(() =>
      validateTheoryQuestionBatch([question], {
        topicSlug: 'react',
        difficulty: 'Junior',
        count: 1,
        existingConceptFingerprints: new Set([
          createQuestionConceptFingerprint({
            topic: question.topicSlug,
            difficulty: question.difficulty,
            learningObjective: question.learningObjective,
            scenarioKey: question.scenarioKey,
          }),
        ]),
      })
    ).toThrow(/duplicate/i);
  });

  it('accepts only complete unique coding problems with examples and starter functions', () => {
    const problem = {
      topic: 'Arrays',
      difficulty: 'Easy',
      title: 'First Repeated Sensor Reading',
      slug: 'first-repeated-sensor-reading',
      description:
        'A monitoring service streams integer readings. Return the first value that appears twice.',
      learningObjective: 'set-membership',
      scenarioKey: 'sensor-stream-first-repeat',
      examples: [
        {
          input: [[4, 2, 4, 1]],
          output: 4,
          explanation: 'Four is the first value observed twice.',
        },
        { input: [[7, 3, 7, 3]], output: 7, explanation: 'Seven repeats before three.' },
      ],
      constraints: ['The input contains at least one repeated value.'],
      codeJs: 'function solution(readings) {\n  // implement\n}',
      codeTs: 'function solution(readings: number[]): number {\n  // implement\n  return 0;\n}',
      codePy: 'def solution(readings):\n    pass',
      referenceSolutions: {
        javascript:
          'function solution(readings) { const seen = new Set(); for (const value of readings) { if (seen.has(value)) return value; seen.add(value); } }',
        typescript:
          'function solution(readings: number[]): number { const seen = new Set<number>(); for (const value of readings) { if (seen.has(value)) return value; seen.add(value); } return 0; }',
        python:
          'def solution(readings):\n    seen = set()\n    for value in readings:\n        if value in seen:\n            return value\n        seen.add(value)\n    return 0',
      },
    };
    expect(
      validateCodingProblemBatch([problem], { topic: 'Arrays', difficulty: 'Easy', count: 1 })
    ).toHaveLength(1);
    expect(() =>
      validateCodingProblemBatch([problem, problem], {
        topic: 'Arrays',
        difficulty: 'Easy',
        count: 2,
      })
    ).toThrow(/duplicate/i);
  });

  it('rejects malformed coding items, invalid starter signatures, and prior prompt or concept matches', () => {
    const problem = {
      topic: 'Arrays',
      difficulty: 'Easy',
      title: 'First Repeated Sensor Reading',
      slug: 'first-repeated-sensor-reading',
      description:
        'A monitoring service streams integer readings. Return the first value that appears twice.',
      learningObjective: 'set-membership',
      scenarioKey: 'sensor-stream-first-repeat',
      examples: [
        {
          input: [[4, 2, 4, 1]],
          output: 4,
          explanation: 'Four is the first value observed twice.',
        },
        { input: [[7, 3, 7, 3]], output: 7, explanation: 'Seven repeats before three.' },
      ],
      constraints: ['The input contains at least one repeated value.'],
      codeJs: 'function solution(readings) {\n  // implement\n}',
      codeTs: 'function solution(readings: number[]): number {\n  // implement\n  return 0;\n}',
      codePy: 'def solution(readings):\n    pass',
      referenceSolutions: {
        javascript: 'function solution(readings) { return 1; }',
        typescript: 'function solution(readings: number[]): number { return 1; }',
        python: 'def solution(readings):\n    return 1',
      },
    };
    const expectation = { topic: 'Arrays', difficulty: 'Easy' as const, count: 1 };
    expect(() => validateCodingProblemBatch([{}], expectation)).toThrow(/invalid structure/i);
    expect(() =>
      validateCodingProblemBatch([{ ...problem, codeJs: 'const solution = () => 1' }], expectation)
    ).toThrow(/starter function/i);
    expect(() =>
      validateCodingProblemBatch([problem], {
        ...expectation,
        existingQuestionFingerprints: new Set([
          createQuestionContentFingerprint(problem.description),
        ]),
      })
    ).toThrow(/duplicate/i);
    expect(() =>
      validateCodingProblemBatch([problem], {
        ...expectation,
        existingConceptFingerprints: new Set([createQuestionConceptFingerprint(problem)]),
      })
    ).toThrow(/duplicate/i);
  });
});
