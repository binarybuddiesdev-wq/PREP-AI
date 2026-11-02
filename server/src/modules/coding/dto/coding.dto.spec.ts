import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListCodingProblemsDto } from './coding.dto.js';

describe('ListCodingProblemsDto', () => {
  it('accepts a human-readable topic name', async () => {
    const dto = Object.assign(new ListCodingProblemsDto(), { topic: 'Arrays' });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects topic names longer than 80 characters', async () => {
    const dto = Object.assign(new ListCodingProblemsDto(), { topic: 'a'.repeat(81) });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('topic');
  });
});
