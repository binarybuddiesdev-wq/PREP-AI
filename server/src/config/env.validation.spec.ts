import { describe, expect, it } from 'vitest';
import { envSchema } from './env.validation.js';

describe('background worker environment validation', () => {
  it('enables the worker by default', () => {
    const result = envSchema.parse({ NODE_ENV: 'test' });

    expect(result.JOBS_WORKER_ENABLED).toBe(true);
  });

  it('allows the API process to disable its worker', () => {
    const result = envSchema.parse({ NODE_ENV: 'test', JOBS_WORKER_ENABLED: 'false' });

    expect(result.JOBS_WORKER_ENABLED).toBe(false);
  });

  it('provides configurable role-based daily AI token budgets', () => {
    const defaults = envSchema.parse({ NODE_ENV: 'test' });
    expect(defaults.AI_DAILY_TOKENS_FREE).toBe(400_000);
    expect(defaults.AI_DAILY_TOKENS_PREMIUM).toBe(2_000_000);

    const configured = envSchema.parse({
      NODE_ENV: 'test',
      AI_DAILY_TOKENS_FREE: '50',
      AI_DAILY_TOKENS_PREMIUM: '500',
    });
    expect(configured.AI_DAILY_TOKENS_FREE).toBe(50);
    expect(configured.AI_DAILY_TOKENS_PREMIUM).toBe(500);
  });
});
