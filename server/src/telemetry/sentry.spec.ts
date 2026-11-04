import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/nestjs';
import {
  captureUnhandledException,
  initializeErrorTracking,
  shutdownErrorTracking,
} from './sentry.js';

vi.mock('@sentry/nestjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/nestjs')>();
  return {
    ...actual,
    init: vi.fn(),
    captureException: vi.fn(),
    flush: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
  };
});

describe('Sentry error tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stays disabled when the DSN is absent or tests are running', async () => {
    expect(initializeErrorTracking({ NODE_ENV: 'production' }, 'api')).toBe(false);
    expect(
      initializeErrorTracking({ NODE_ENV: 'test', SENTRY_DSN: 'https://example.invalid/1' }, 'api')
    ).toBe(false);

    expect(Sentry.init).not.toHaveBeenCalled();
    await captureUnhandledException(new Error('test error'));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('initializes with stable service tags and disables Sentry tracing', () => {
    expect(
      initializeErrorTracking(
        {
          NODE_ENV: 'production',
          SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
          SENTRY_RELEASE: '0.0.1+abc123',
          REGION: 'ap-south-1',
        },
        'worker'
      )
    ).toBe(true);

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@example.ingest.sentry.io/1',
        environment: 'production',
        release: '0.0.1+abc123',
        sampleRate: 1,
        tracesSampleRate: 0,
        sendDefaultPii: false,
        initialScope: {
          tags: { service: 'worker', nodeEnv: 'production', region: 'ap-south-1' },
        },
        beforeSend: expect.any(Function),
      })
    );
  });

  it('uses the same SHA-based release even when npm injects a package version', () => {
    initializeErrorTracking(
      {
        NODE_ENV: 'production',
        SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
        npm_package_version: '0.0.1',
        GIT_SHA: 'abc123',
      },
      'api'
    );

    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ release: 'prepai+abc123' }));
  });

  it('removes request and user data before an event can leave the process', () => {
    initializeErrorTracking(
      { NODE_ENV: 'production', SENTRY_DSN: 'https://public@example.ingest.sentry.io/1' },
      'api'
    );
    const options = vi.mocked(Sentry.init).mock.calls[0]?.[0];
    const beforeSend = options?.beforeSend;
    expect(beforeSend).toBeTypeOf('function');

    const event = {
      message: 'database failed',
      request: { url: '/users?token=secret' },
      user: { id: 'user-1', email: 'private@example.com' },
      breadcrumbs: [{ message: 'sensitive input' }],
      extra: { prompt: 'private data' },
    };

    expect(beforeSend?.(event as never, {} as never)).toEqual({ message: 'database failed' });
  });

  it('captures and flushes bootstrap errors, then closes the SDK on shutdown', async () => {
    initializeErrorTracking(
      { NODE_ENV: 'production', SENTRY_DSN: 'https://public@example.ingest.sentry.io/1' },
      'api'
    );
    const error = new Error('startup failed');

    await captureUnhandledException(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2_000);
    await shutdownErrorTracking();

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(Sentry.flush).toHaveBeenCalledWith(2_000);
    expect(Sentry.close).toHaveBeenCalledWith(2_000);
  });
});
