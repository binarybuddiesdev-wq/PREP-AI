import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import {
  getAiTokenBudgetLimit,
  getCodingLimits,
  getTheoryLimits,
  isPremiumUser,
} from './role-limits.js';

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

  it('uses premium theory defaults when configuration is absent', () => {
    const config = { get: vi.fn(() => undefined) };
    expect(getTheoryLimits('PREMIUM', config as unknown as ConfigService)).toEqual({
      dailySessions: 999,
      questionsPerSession: 30,
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

  it('uses premium coding defaults when configuration is absent', () => {
    const config = { get: vi.fn(() => undefined) };
    expect(getCodingLimits('PREMIUM', config as unknown as ConfigService)).toEqual({
      dailySolved: 999,
      dailyReviews: 999,
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

  it('provides configurable role-based daily AI token budgets', () => {
    const config = {
      get: vi.fn((key: string) =>
        key === 'AI_DAILY_TOKENS_PREMIUM'
          ? 900_000
          : key === 'AI_DAILY_TOKENS_FREE'
            ? 75_000
            : undefined
      ),
    };
    expect(getAiTokenBudgetLimit('USER', config as unknown as ConfigService)).toBe(75_000);
    expect(getAiTokenBudgetLimit('PREMIUM', config as unknown as ConfigService)).toBe(900_000);
    expect(getAiTokenBudgetLimit('ADMIN', config as unknown as ConfigService)).toBe(900_000);
  });

  it('defaults the daily AI budget when configuration is absent', () => {
    const config = { get: vi.fn(() => undefined) };
    expect(getAiTokenBudgetLimit('USER', config as unknown as ConfigService)).toBe(400_000);
    expect(getAiTokenBudgetLimit('PREMIUM', config as unknown as ConfigService)).toBe(2_000_000);
  });
});
