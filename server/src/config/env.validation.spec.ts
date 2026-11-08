import { describe, expect, it } from 'vitest';
import { envSchema } from './env.validation.js';

describe('background worker environment validation', () => {
  it('requires a long dedicated token before enabling metrics scrapes', () => {
    expect(() =>
      envSchema.parse({ NODE_ENV: 'test', METRICS_BEARER_TOKEN: 'too-short' })
    ).toThrow();
    expect(
      envSchema.parse({ NODE_ENV: 'test', METRICS_BEARER_TOKEN: 'm'.repeat(32) })
        .METRICS_BEARER_TOKEN
    ).toBe('m'.repeat(32));
  });

  it('enables the worker by default', () => {
    const result = envSchema.parse({ NODE_ENV: 'test' });

    expect(result.JOBS_WORKER_ENABLED).toBe(true);
  });

  it('allows the complete repository PDF set within the default Library quotas', () => {
    const result = envSchema.parse({ NODE_ENV: 'test' });

    expect(result.PDF_MAX_PAGES).toBe(400);
    expect(result.PDF_MAX_FILES_PER_USER).toBe(10);
    expect(result.PDF_DAILY_UPLOADS_PER_USER).toBe(9);
    expect(result.PDF_MAX_STORAGE_BYTES_PER_USER).toBe(50 * 1024 * 1024);
    expect(result.PDF_SIMILARITY_THRESHOLD).toBe(0.15);
  });

  it('allows the API process to disable its worker', () => {
    const result = envSchema.parse({ NODE_ENV: 'test', JOBS_WORKER_ENABLED: 'false' });

    expect(result.JOBS_WORKER_ENABLED).toBe(false);
  });

  it('bounds question-bank generation with a configurable positive daily batch cap', () => {
    expect(envSchema.parse({ NODE_ENV: 'test' }).QUESTION_BANK_MAX_BATCHES_PER_DAY).toBe(40);
    expect(
      envSchema.parse({ NODE_ENV: 'test', QUESTION_BANK_MAX_BATCHES_PER_DAY: '12' })
        .QUESTION_BANK_MAX_BATCHES_PER_DAY
    ).toBe(12);
    expect(
      envSchema.safeParse({ NODE_ENV: 'test', QUESTION_BANK_MAX_BATCHES_PER_DAY: '0' }).success
    ).toBe(false);
  });

  it('requires the restricted PostgreSQL worker URL in production even when jobs are disabled', () => {
    const base = {
      NODE_ENV: 'production',
      DATABASE_URL: 'mongodb://localhost/prepai',
      JOBS_WORKER_ENABLED: 'false',
    };

    expect(envSchema.safeParse(base).success).toBe(false);
    expect(
      envSchema.safeParse({
        ...base,
        POSTGRESQL_WORKER_URL: 'postgresql://worker@localhost/prepai',
      }).success
    ).toBe(true);
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

  it('allows valid optional Resend delivery configuration and rejects a weak unsubscribe secret', () => {
    expect(() =>
      envSchema.parse({
        NODE_ENV: 'test',
        RESEND_API_KEY: 're_test',
        RESEND_FROM_EMAIL: 'PrepAI <hello@example.test>',
        EMAIL_UNSUBSCRIBE_SECRET: 's'.repeat(32),
        API_BASE_URL: 'https://api.example.test',
      })
    ).not.toThrow();
    expect(() =>
      envSchema.parse({ NODE_ENV: 'test', EMAIL_UNSUBSCRIBE_SECRET: 'short' })
    ).toThrow();
  });
});
