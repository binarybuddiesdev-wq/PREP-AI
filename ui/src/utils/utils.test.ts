import { describe, expect, it } from 'vitest';
import { cn } from './cn';
import { formatDate } from './formatDate';

describe('cn', () => {
  it('merges conflicting tailwind classes, keeping the last', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', { b: false }, undefined, 'c')).toBe('a c');
  });
});

describe('formatDate', () => {
  it.each([null, undefined, '', 'not a date'])('returns the fallback for %s', (value) => {
    expect(formatDate(value)).toBe('N/A');
  });

  it('uses a custom fallback', () => {
    expect(formatDate(null, '-')).toBe('-');
  });

  it('formats a valid date', () => {
    const date = new Date(2026, 0, 15);
    expect(formatDate(date)).toBe(date.toLocaleDateString());
  });
});
