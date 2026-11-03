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

  it('accepts PDF sessions with one to five Mongo PDF IDs', async () => {
    const dto = plainToInstance(StartSessionDto, {
      mode: 'pdf',
      pdfIds: ['507f1f77bcf86cd799439011'],
      difficulty: 'Mid',
      totalQuestions: 10,
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);

    const missingSources = plainToInstance(StartSessionDto, {
      mode: 'pdf',
      difficulty: 'Mid',
      totalQuestions: 10,
    });
    expect((await validate(missingSources)).some((error) => error.property === 'pdfIds')).toBe(
      true
    );
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
