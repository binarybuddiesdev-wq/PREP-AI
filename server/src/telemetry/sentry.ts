import * as Sentry from '@sentry/nestjs';

type TSentryEvent = Parameters<
  NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>['beforeSend']>
>[0];

let errorTrackingInitialized = false;

export function initializeErrorTracking(
  env: NodeJS.ProcessEnv = process.env,
  service: 'api' | 'worker' = 'api'
): boolean {
  errorTrackingInitialized = false;
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn || env.NODE_ENV === 'test') return false;

  const nodeEnv = env.NODE_ENV ?? 'development';
  const region = env.REGION?.trim();
  Sentry.init({
    dsn,
    environment: nodeEnv,
    release:
      env.SENTRY_RELEASE ?? `${env.npm_package_version ?? 'prepai'}+${env.GIT_SHA ?? 'local'}`,
    sampleRate: 1,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    initialScope: {
      tags: {
        service,
        nodeEnv,
        ...(region ? { region } : {}),
      },
    },
    beforeSend: sanitizeSentryEvent,
  });
  errorTrackingInitialized = true;
  return true;
}

export async function captureUnhandledException(error: unknown): Promise<void> {
  if (!errorTrackingInitialized) return;
  Sentry.captureException(error);
  await Sentry.flush(2_000).catch(() => false);
}

export async function shutdownErrorTracking(): Promise<void> {
  if (!errorTrackingInitialized) return;
  errorTrackingInitialized = false;
  await Sentry.close(2_000);
}

function sanitizeSentryEvent(event: TSentryEvent): TSentryEvent {
  const {
    request: _request,
    user: _user,
    breadcrumbs: _breadcrumbs,
    extra: _extra,
    ...safeEvent
  } = event;
  return safeEvent;
}
