import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { StartSessionDto, SubmitAnswerDto } from './index.js';

describe('Theory request DTOs', () => {
  it('requires a topic id for topic sessions', async () => {
    const dto = plainToInstance(StartSessionDto, {
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: 10,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'topicId')).toBe(true);
  });

  it('rejects PDF sessions until PDF question generation is implemented', async () => {
    const dto = plainToInstance(StartSessionDto, {
      mode: 'pdf',
      difficulty: 'Mid',
      totalQuestions: 10,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'mode')).toBe(true);
  });

  it('rejects oversized question text and answers before they reach the evaluator', async () => {
    const dto = plainToInstance(SubmitAnswerDto, {
      questionText: 'q'.repeat(2001),
      userAnswer: 'a'.repeat(8001),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'questionText')).toBe(true);
    expect(errors.some((error) => error.property === 'userAnswer')).toBe(true);
  });
});
