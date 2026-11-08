import { expect, test } from '@playwright/test';

const privateReadRoutes = [
  '/api/v1/users/me',
  '/api/v1/topics',
  '/api/v1/questions',
  '/api/v1/theory/stats',
  '/api/v1/coding/problems',
  '/api/v1/pdfs',
  '/api/v1/study-chat/conversations',
  '/api/v1/notifications',
];

test('all core APIs reject anonymous requests with an authorization error', async ({ request }) => {
  for (const path of privateReadRoutes) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
  }
});

test('health and readiness endpoints report service status', async ({ request }) => {
  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  await expect(health.json()).resolves.toMatchObject({ data: { status: 'ok' } });

  const liveness = await request.get('/healthz');
  expect(liveness.status()).toBe(200);
  await expect(liveness.json()).resolves.toMatchObject({ data: { status: 'ok' } });

  const readiness = await request.get('/readyz');
  expect(readiness.status()).toBe(200);
  await expect(readiness.json()).resolves.toMatchObject({ data: { status: 'ready' } });
});
