import { describe, expect, it } from 'vitest';

import { formatCodingValue } from './formatCodingValue';

describe('formatCodingValue', () => {
  it('keeps small nested test values on one line', () => {
    expect(formatCodingValue([[2, 7, 11, 15], 9])).toBe('[[2, 7, 11, 15], 9]');
    expect(formatCodingValue([0, 1])).toBe('[0, 1]');
  });

  it('preserves punctuation inside string values', () => {
    expect(formatCodingValue(['two,sum', 'target: 9'])).toBe('["two,sum", "target: 9"]');
  });

  it('indents larger values so they remain readable', () => {
    const value = { items: Array.from({ length: 20 }, (_, index) => `item-${index}`) };

    expect(formatCodingValue(value)).toBe(JSON.stringify(value, null, 2));
  });

  it('renders values JSON cannot serialize', () => {
    expect(formatCodingValue(undefined)).toBe('undefined');
  });
});
