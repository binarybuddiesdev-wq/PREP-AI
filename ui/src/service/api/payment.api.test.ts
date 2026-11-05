import { describe, expect, it } from 'vitest';

import { createApiClient } from './apiClient';
import {
  cancelCurrentSubscription,
  createSubscription,
  getCurrentSubscription,
} from './payment.api';

const subscription = {
  id: 'subscription_1',
  plan: 'yearly',
  status: 'created',
  cancelAtPeriodEnd: false,
  checkoutUrl: 'https://rzp.io/i/test',
  currentPeriodStart: null,
  currentPeriodEnd: null,
  createdAt: '2026-11-05T00:00:00.000Z',
};

describe('payment API', () => {
  it('reads the authenticated user current subscription', async () => {
    const requests: Request[] = [];
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: subscription }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(getCurrentSubscription(api)).resolves.toMatchObject({ data: subscription });
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url).toBe('http://api.test/api/v1/payments/subscriptions/current');
  });

  it('creates only the selected plan with the supplied idempotency key', async () => {
    const requests: Request[] = [];
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        const captured = request instanceof Request ? request.clone() : new Request(request);
        requests.push(captured);
        return new Response(JSON.stringify({ success: true, message: 'ok', data: subscription }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await createSubscription(api, { plan: 'yearly' }, 'retry-safe-key_1');

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://api.test/api/v1/payments/subscriptions');
    expect(await requests[0].json()).toEqual({ plan: 'yearly' });
    expect(requests[0].headers.get('Idempotency-Key')).toBe('retry-safe-key_1');
  });

  it('schedules cancellation without a client-selected subscription ID or request body', async () => {
    const requests: Request[] = [];
    const api = createApiClient({
      baseUrl: 'http://api.test',
      getToken: async () => 'token',
      fetchImplementation: async (request) => {
        requests.push(request instanceof Request ? request.clone() : new Request(request));
        return new Response(JSON.stringify({ success: true, message: 'ok', data: subscription }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await cancelCurrentSubscription(api);

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('http://api.test/api/v1/payments/subscriptions/current/cancel');
    expect(requests[0].headers.get('content-type')).toBeNull();
  });
});
