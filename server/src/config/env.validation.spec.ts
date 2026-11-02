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
});
