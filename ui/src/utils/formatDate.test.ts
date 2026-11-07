import { describe, expect, it } from 'vitest';

import { formatDate } from './formatDate';

describe('formatDate', () => {
  it.each([null, undefined, ''])('uses the fallback for an empty date value (%s)', (value) => {
    expect(formatDate(value)).toBe('N/A');
  });

  it.each(['not-a-date', Number.NaN, Number.POSITIVE_INFINITY])(
    'uses the fallback for an invalid date value (%s)',
    (value) => {
      expect(formatDate(value)).toBe('N/A');
    }
  );

  it('allows callers to choose the missing-date fallback', () => {
    expect(formatDate(null, 'Not recorded')).toBe('Not recorded');
    expect(formatDate('invalid', 'Not recorded')).toBe('Not recorded');
  });

  it.each([
    ['2026-11-05T06:00:00.000Z', new Date('2026-11-05T06:00:00.000Z')],
    [Date.UTC(2026, 10, 5, 6), new Date(Date.UTC(2026, 10, 5, 6))],
  ])('formats supported date input types', (value, expected) => {
    expect(formatDate(value)).toBe(expected.toLocaleDateString());
  });
});
