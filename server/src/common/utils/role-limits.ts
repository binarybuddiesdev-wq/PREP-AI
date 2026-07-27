import { ConfigService } from '@nestjs/config';

export interface RoleLimits {
  dailySessions: number;
  questionsPerSession: number;
}

export interface CodingLimits {
  dailySolved: number;
  dailyReviews: number;
}

export function getTheoryLimits(role: string, config: ConfigService): RoleLimits {
  const isPremium = role === 'PREMIUM' || role === 'ADMIN';

  return {
    dailySessions: isPremium
      ? config.get<number>('THEORY_DAILY_SESSIONS_PREMIUM') ?? 999
      : config.get<number>('THEORY_DAILY_SESSIONS_FREE') ?? 3,
    questionsPerSession: isPremium
      ? config.get<number>('THEORY_QUESTIONS_PER_SESSION_PREMIUM') ?? 30
      : config.get<number>('THEORY_QUESTIONS_PER_SESSION_FREE') ?? 10,
  };
}

export function getCodingLimits(role: string, config: ConfigService): CodingLimits {
  const isPremium = role === 'PREMIUM' || role === 'ADMIN';

  return {
    dailySolved: isPremium
      ? config.get<number>('CODING_DAILY_SOLVED_PREMIUM') ?? 999
      : config.get<number>('CODING_DAILY_SOLVED_FREE') ?? 5,
    dailyReviews: isPremium
      ? config.get<number>('CODING_DAILY_REVIEWS_PREMIUM') ?? 999
      : config.get<number>('CODING_DAILY_REVIEWS_FREE') ?? 3,
  };
}

export function isPremiumUser(role: string): boolean {
  return role === 'PREMIUM' || role === 'ADMIN';
}
