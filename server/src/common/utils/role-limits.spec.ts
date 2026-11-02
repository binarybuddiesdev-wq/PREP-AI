import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { getCodingLimits, getTheoryLimits, isPremiumUser } from './role-limits.js';

describe('role limits', () => {
  it.each(['PREMIUM', 'ADMIN'])('uses premium theory limits for %s', (role) => {
    const config = {
      get: vi.fn((key: string) =>
        key === 'THEORY_DAILY_SESSIONS_PREMIUM'
          ? 50
          : key === 'THEORY_QUESTIONS_PER_SESSION_PREMIUM'
            ? 40
            : undefined
      ),
    };

    expect(getTheoryLimits(role, config as unknown as ConfigService)).toEqual({
      dailySessions: 50,
      questionsPerSession: 40,
    });
  });

  it('uses free theory limit defaults when configuration is absent', () => {
    const config = { get: vi.fn(() => undefined) };
    expect(getTheoryLimits('USER', config as unknown as ConfigService)).toEqual({
      dailySessions: 3,
      questionsPerSession: 10,
    });
  });

  it('uses configured free theory limits', () => {
    const config = { get: vi.fn((key: string) => (key.includes('SESSIONS') ? 2 : 8)) };
    expect(getTheoryLimits('USER', config as unknown as ConfigService)).toEqual({
      dailySessions: 2,
      questionsPerSession: 8,
    });
  });

  it.each(['PREMIUM', 'ADMIN'])('uses premium coding limits for %s', (role) => {
    const config = {
      get: vi.fn((key: string) =>
        key === 'CODING_DAILY_SOLVED_PREMIUM'
          ? 50
          : key === 'CODING_DAILY_REVIEWS_PREMIUM'
            ? 40
            : undefined
      ),
    };

    expect(getCodingLimits(role, config as unknown as ConfigService)).toEqual({
      dailySolved: 50,
      dailyReviews: 40,
    });
  });

  it('uses free coding limit defaults when configuration is absent', () => {
    const config = { get: vi.fn(() => undefined) };
    expect(getCodingLimits('USER', config as unknown as ConfigService)).toEqual({
      dailySolved: 5,
      dailyReviews: 3,
    });
  });

  it('uses configured free coding limits', () => {
    const config = { get: vi.fn((key: string) => (key.includes('SOLVED') ? 6 : 4)) };
    expect(getCodingLimits('USER', config as unknown as ConfigService)).toEqual({
      dailySolved: 6,
      dailyReviews: 4,
    });
  });

  it('recognizes only premium and admin roles as premium', () => {
    expect(isPremiumUser('PREMIUM')).toBe(true);
    expect(isPremiumUser('ADMIN')).toBe(true);
    expect(isPremiumUser('USER')).toBe(false);
  });
});
