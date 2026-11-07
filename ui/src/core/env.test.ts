import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Clerk browser-key configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects a missing or placeholder publishable key', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'your_clerk_publishable_key_here');
    vi.resetModules();

    const { IS_CLERK_CONFIGURATION_VALID } = await import('./env');

    expect(IS_CLERK_CONFIGURATION_VALID).toBe(false);
  });

  it('accepts a Clerk test publishable key', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_test_1234567890');
    vi.resetModules();

    const { CLERK_PUBLISHABLE_KEY, IS_CLERK_CONFIGURATION_VALID } = await import('./env');

    expect(CLERK_PUBLISHABLE_KEY).toBe('pk_test_1234567890');
    expect(IS_CLERK_CONFIGURATION_VALID).toBe(true);
  });

  it('accepts a Clerk live publishable key', async () => {
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_live_1234567890');
    vi.resetModules();

    const { IS_CLERK_CONFIGURATION_VALID } = await import('./env');

    expect(IS_CLERK_CONFIGURATION_VALID).toBe(true);
  });
});
