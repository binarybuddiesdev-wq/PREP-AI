import { describe, expect, it } from 'vitest';

import { getPracticePolicy } from './practicePolicy';

describe('getPracticePolicy', () => {
  it.each(['USER', 'unknown', ''])('uses the standard quota for role %s', (role) => {
    expect(getPracticePolicy(role)).toEqual({ isPremium: false, totalQuestions: 10 });
  });

  it.each(['PREMIUM', 'ADMIN'])('uses the extended quota for role %s', (role) => {
    expect(getPracticePolicy(role)).toEqual({ isPremium: true, totalQuestions: 30 });
  });
});
