import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(z.object({ name: z.string().trim() }));

  it('returns parsed and transformed input', () => {
    expect(pipe.transform({ name: ' Ada ' })).toEqual({ name: 'Ada' });
  });

  it('throws a BadRequestException with formatted validation errors', () => {
    expect(() => pipe.transform({ name: 1 })).toThrow(BadRequestException);
  });
});
