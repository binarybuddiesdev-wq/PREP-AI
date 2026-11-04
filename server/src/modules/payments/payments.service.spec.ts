import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import { RazorpayApiError, RazorpayProvider } from './razorpay-provider.js';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@/generated/postgresql-client/index.js';

const configuredProvider = () =>
  new RazorpayProvider({
    get: (key: string) =>
      (
        ({
          RAZORPAY_KEY_ID: 'key_test',
          RAZORPAY_KEY_SECRET: 'secret_test',
          RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
          RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
          RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
        }) as Record<string, string>
      )[key],
  } as unknown as ConfigService);

const subscriptionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'local_1',
  idempotencyKey: 'request-1',
  planKey: 'monthly',
  status: 'creating',
  shortUrl: null,
  currentStart: null,
  currentEnd: null,
  createdAt: new Date('2026-11-04T00:00:00Z'),
  ...overrides,
});

const postgresFor = (tx: Record<string, unknown>) => ({
  client_: { $executeRaw: vi.fn() },
  workerClient_: { $executeRaw: vi.fn() },
  withTenantContext: vi.fn(async (_userId: string, operation: (value: never) => unknown) =>
    operation(tx as never)
  ),
});

const createWebhookRequest = (eventId = 'evt_1') => {
  const rawBody = Buffer.from(
    JSON.stringify({
      event: 'subscription.activated',
      created_at: 1793793600,
      payload: {
        subscription: {
          entity: {
            id: 'sub_123',
            plan_id: 'plan_monthly',
            status: 'active',
            updated_at: 1793793600,
            notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
          },
        },
      },
    })
  );
  return {
    rawBody,
    signature: createHmac('sha256', 'webhook_secret').update(rawBody).digest('hex'),
    eventId,
  };
};

describe('PaymentsService webhook intake', () => {
  it('creates one provider subscription after persisting the local idempotent request', async () => {
    const row = subscriptionRow();
    const webhookProcessedRow = subscriptionRow({
      status: 'active',
      razorpaySubscriptionId: 'sub_123',
      currentStart: new Date(Date.now() - 1_000),
      currentEnd: new Date(Date.now() + 60_000),
    });
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(webhookProcessedRow),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(row),
        update: vi
          .fn()
          .mockResolvedValue({ ...webhookProcessedRow, shortUrl: 'https://rzp.io/i/1' }),
      },
    };
    const postgres = postgresFor(tx);
    const provider = configuredProvider();
    const create = vi.spyOn(provider, 'createSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'created',
      short_url: 'https://rzp.io/i/1',
    });
    const service = new PaymentsService({} as never, postgres as never, provider, {} as never);

    const result = await service.startSubscription('user_1', { plan: 'monthly' }, 'request-1');

    expect(create).toHaveBeenCalledWith('user_1', 'monthly', 'request-1');
    expect(tx.paymentSubscription.create).toHaveBeenCalledOnce();
    expect(tx.paymentSubscription.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { shortUrl: 'https://rzp.io/i/1' },
    });
    expect(result).toMatchObject({ plan: 'monthly', checkoutUrl: 'https://rzp.io/i/1' });
  });

  it('reuses a matching idempotency request and rejects conflicting or concurrent plans', async () => {
    const existing = { ...subscriptionRow(), idempotencyKey: 'request-1' };
    const reusedTx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(existing),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    const provider = configuredProvider();
    const create = vi.spyOn(provider, 'createSubscription');
    const reused = new PaymentsService(
      {} as never,
      postgresFor(reusedTx) as never,
      provider,
      {} as never
    );
    await expect(
      reused.startSubscription('user_1', { plan: 'monthly' }, 'request-1')
    ).resolves.toMatchObject({ id: 'local_1', status: 'creating' });
    expect(create).not.toHaveBeenCalled();

    const mismatch = new PaymentsService(
      {} as never,
      postgresFor(reusedTx) as never,
      provider,
      {} as never
    );
    await expect(
      mismatch.startSubscription('user_1', { plan: 'yearly' }, 'request-1')
    ).rejects.toThrow(ConflictException);

    const activeTx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: 'other_subscription' }),
        create: vi.fn(),
      },
    };
    const active = new PaymentsService(
      {} as never,
      postgresFor(activeTx) as never,
      provider,
      {} as never
    );
    await expect(
      active.startSubscription('user_1', { plan: 'yearly' }, 'request-2')
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a missing idempotency key and reports disabled checkout configuration', async () => {
    const provider = configuredProvider();
    const service = new PaymentsService({} as never, {} as never, provider, {} as never);
    await expect(
      service.startSubscription('user_1', { plan: 'monthly' }, undefined)
    ).rejects.toThrow(BadRequestException);

    const disabled = new PaymentsService(
      {} as never,
      {} as never,
      new RazorpayProvider({ get: () => undefined } as unknown as ConfigService),
      {} as never
    );
    await expect(
      disabled.startSubscription('user_1', { plan: 'monthly' }, 'request-1')
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('keeps an ambiguous provider failure pending and does not repeat the provider call', async () => {
    const row = subscriptionRow();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(row),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(row),
      },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'createSubscription').mockRejectedValue(new Error('network timeout'));
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );
    await expect(
      service.startSubscription('user_1', { plan: 'monthly' }, 'request-1')
    ).rejects.toThrow(ServiceUnavailableException);
    await expect(
      service.startSubscription('user_1', { plan: 'monthly' }, 'request-1')
    ).resolves.toMatchObject({ status: 'creating', checkoutUrl: null });
    expect(tx.paymentSubscription.create).toHaveBeenCalledOnce();
  });

  it('returns the current non-terminal subscription or null', async () => {
    const row = subscriptionRow();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findFirst: vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(null),
      },
    };
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      configuredProvider(),
      {} as never
    );
    await expect(service.getCurrentSubscription('user_1')).resolves.toMatchObject({
      id: 'local_1',
    });
    await expect(service.getCurrentSubscription('user_1')).resolves.toBeNull();
  });

  it('rejects a bad signature before touching persistent state', async () => {
    const postgres = { withTenantContext: vi.fn() };
    const service = new PaymentsService({} as never, postgres as never, configuredProvider(), {
      enqueue: vi.fn(),
    } as never);

    await expect(
      service.acceptWebhook(Buffer.from('{}'), '00'.repeat(32), 'evt_1')
    ).rejects.toThrow(BadRequestException);
    expect(postgres.withTenantContext).not.toHaveBeenCalled();
  });

  it('rejects missing event IDs and malformed signed payloads before persistence', async () => {
    const postgres = { withTenantContext: vi.fn() };
    const service = new PaymentsService(
      {} as never,
      postgres as never,
      configuredProvider(),
      {} as never
    );
    const good = createWebhookRequest();
    await expect(service.acceptWebhook(good.rawBody, good.signature, undefined)).rejects.toThrow(
      BadRequestException
    );
    const malformed = Buffer.from('{invalid-json');
    const signature = createHmac('sha256', 'webhook_secret').update(malformed).digest('hex');
    await expect(service.acceptWebhook(malformed, signature, 'evt_2')).rejects.toThrow(
      'Invalid Razorpay webhook payload'
    );
    expect(postgres.withTenantContext).not.toHaveBeenCalled();
  });

  it('rejects validly signed events that do not match a saved subscription', async () => {
    const request = createWebhookRequest();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findUnique: vi.fn().mockResolvedValue(null) },
      paymentWebhookEvent: { findUnique: vi.fn() },
    };
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      configuredProvider(),
      {} as never
    );
    await expect(
      service.acceptWebhook(request.rawBody, request.signature, request.eventId)
    ).rejects.toThrow(BadRequestException);
    expect(tx.paymentWebhookEvent.findUnique).not.toHaveBeenCalled();
  });

  it('reuses an already persisted webhook and reports queue failure for provider retry', async () => {
    const request = createWebhookRequest();
    const subscription = {
      id: 'local_1',
      userId: 'user_1',
      idempotencyKey: 'req_1',
      razorpayPlanId: 'plan_monthly',
      razorpaySubscriptionId: 'sub_123',
    };
    const prior = {
      id: 'event_1',
      userId: 'user_1',
      eventId: request.eventId,
      subscriptionId: 'sub_123',
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findUnique: vi.fn().mockResolvedValue(subscription), update: vi.fn() },
      paymentWebhookEvent: {
        findUnique: vi.fn().mockResolvedValue(prior),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const jobs = { enqueue: vi.fn().mockRejectedValue(new Error('Redis unavailable')) };
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      configuredProvider(),
      jobs as never
    );
    await expect(
      service.acceptWebhook(request.rawBody, request.signature, request.eventId)
    ).rejects.toThrow(ServiceUnavailableException);
    expect(tx.paymentWebhookEvent.create).not.toHaveBeenCalled();
    expect(tx.paymentWebhookEvent.update).not.toHaveBeenCalled();
  });

  it('accepts a verified webhook only after durable persistence and queue dispatch', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'subscription.activated',
        created_at: 1793793600,
        payload: {
          subscription: {
            entity: {
              id: 'sub_123',
              plan_id: 'plan_monthly',
              status: 'active',
              updated_at: 1793793600,
              notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
            },
          },
        },
      })
    );
    const signature = createHmac('sha256', 'webhook_secret').update(rawBody).digest('hex');
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'local_1',
          userId: 'user_1',
          idempotencyKey: 'req_1',
          razorpayPlanId: 'plan_monthly',
          razorpaySubscriptionId: null,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      paymentWebhookEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'event_1', userId: 'user_1', eventId: 'evt_1' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const postgres = { withTenantContext: vi.fn(async (_userId, operation) => operation(tx)) };
    const jobs = { enqueue: vi.fn().mockResolvedValue('job_1') };
    const service = new PaymentsService(
      {} as never,
      postgres as never,
      configuredProvider(),
      jobs as never
    );

    await expect(service.acceptWebhook(rawBody, signature, 'evt_1')).resolves.toEqual({
      received: true,
    });
    expect(tx.paymentWebhookEvent.create).toHaveBeenCalledOnce();
    expect(jobs.enqueue).toHaveBeenCalledWith(
      'payment-reconcile-queue',
      {
        idempotencyKey: 'evt_1',
        userId: 'user_1',
      },
      'reconcile-subscription',
      true
    );
  });

  it('persists only captured payment fields for a verified subscription charge', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'subscription.charged',
        created_at: 1793793600,
        payload: {
          subscription: {
            entity: {
              id: 'sub_123',
              plan_id: 'plan_monthly',
              status: 'active',
              notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
            },
          },
          payment: {
            entity: {
              id: 'pay_123',
              invoice_id: 'inv_123',
              amount: 49900,
              currency: 'INR',
              status: 'captured',
              captured: '1',
              created_at: 1793793500,
              method: 'card',
              card_id: 'sensitive_card_id',
              contact: '+919999999999',
            },
          },
        },
      })
    );
    const signature = createHmac('sha256', 'webhook_secret').update(rawBody).digest('hex');
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'local_1',
          userId: 'user_1',
          idempotencyKey: 'req_1',
          razorpayPlanId: 'plan_monthly',
          razorpaySubscriptionId: 'sub_123',
        }),
      },
      paymentCharge: {
        upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
      paymentWebhookEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'event_1', userId: 'user_1' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      configuredProvider(),
      { enqueue: vi.fn().mockResolvedValue('job_1') } as never
    );

    await expect(service.acceptWebhook(rawBody, signature, 'evt_charge')).resolves.toEqual({
      received: true,
    });

    expect(tx.paymentCharge.upsert).toHaveBeenCalledWith({
      where: { razorpayPaymentId: 'pay_123' },
      create: {
        userId: 'user_1',
        subscriptionId: 'local_1',
        razorpaySubscriptionId: 'sub_123',
        razorpayPaymentId: 'pay_123',
        invoiceId: 'inv_123',
        amountMinor: 49900,
        currency: 'INR',
        chargedAt: new Date(1793793500 * 1000),
      },
      update: {},
    });
    expect(JSON.stringify(tx.paymentCharge.upsert.mock.calls[0])).not.toContain(
      'sensitive_card_id'
    );
    expect(JSON.stringify(tx.paymentCharge.upsert.mock.calls[0])).not.toContain('+919999999999');

    const storedCharge = tx.paymentCharge.upsert.mock.calls[0][0].create;
    for (const [eventId, conflict] of [
      ['evt_charge_collision_owner', { userId: 'user_2' }],
      ['evt_charge_collision_subscription', { subscriptionId: 'local_other' }],
      ['evt_charge_collision_provider_subscription', { razorpaySubscriptionId: 'sub_other' }],
      ['evt_charge_collision_amount', { amountMinor: 1 }],
    ] as const) {
      tx.paymentCharge.upsert.mockResolvedValueOnce({ ...storedCharge, ...conflict });
      await expect(service.acceptWebhook(rawBody, signature, eventId)).rejects.toThrow(
        BadRequestException
      );
    }
    expect(tx.paymentWebhookEvent.create).toHaveBeenCalledOnce();
  });

  it('fetches current provider state and projects Premium before completing the inbox event', async () => {
    const local = {
      id: 'local_1',
      userId: 'user_1',
      idempotencyKey: 'req_1',
      planKey: 'monthly',
      razorpayPlanId: 'plan_monthly',
      razorpaySubscriptionId: 'sub_123',
      status: 'created',
      currentStart: null,
      currentEnd: null,
    };
    const event = {
      id: 'event_1',
      userId: 'user_1',
      eventId: 'evt_1',
      idempotencyKey: 'req_1',
      subscriptionId: 'sub_123',
      processedAt: null,
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: { findFirst: vi.fn().mockResolvedValue(event), update: vi.fn() },
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(local),
        findMany: vi.fn().mockResolvedValue([
          {
            status: 'active',
            currentStart: new Date(Date.now() - 1_000),
            currentEnd: new Date(Date.now() + 60_000),
          },
        ]),
        update: vi.fn().mockResolvedValue({
          ...local,
          status: 'active',
          currentStart: new Date(Date.now() - 1_000),
          currentEnd: new Date(Date.now() + 60_000),
        }),
      },
    };
    const postgres = {
      client_: { $executeRaw: vi.fn() },
      workerClient_: { $executeRaw: vi.fn() },
      withTenantContext: vi.fn(async (_userId: string, operation: (value: typeof tx) => unknown) =>
        operation(tx)
      ),
    };
    const mongo = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'USER' }), update: vi.fn() },
      inAppNotification: { create: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'active',
      current_start: Math.floor((Date.now() - 1_000) / 1000),
      current_end: Math.floor((Date.now() + 60_000) / 1000),
      updated_at: Math.floor(Date.now() / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
    });
    const service = new PaymentsService(mongo as never, postgres as never, provider, {
      enqueue: vi.fn(),
    } as never);

    await service.processWebhookEvent('user_1', 'evt_1');

    expect(mongo.inAppNotification.create).toHaveBeenCalledOnce();
    expect(mongo.user.update).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_1' },
      data: { role: 'PREMIUM' },
    });
    expect(postgres.workerClient_.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mongo.user.update.mock.invocationCallOrder[0]!
    );
    expect(tx.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event_1' },
        data: expect.objectContaining({ status: 'processed' }),
      })
    );
  });

  it('skips processed webhook events and rejects an event without its saved provider subscription', async () => {
    const processed = { id: 'event_1', processedAt: new Date() };
    const tx = {
      paymentWebhookEvent: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(processed)
          .mockResolvedValueOnce({ ...processed, processedAt: null }),
      },
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue({ id: 'local_1', razorpaySubscriptionId: null }),
      },
    };
    const provider = configuredProvider();
    const fetch = vi.spyOn(provider, 'fetchSubscription');
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await service.processWebhookEvent('user_1', 'evt_done');
    expect(fetch).not.toHaveBeenCalled();
    await expect(service.processWebhookEvent('user_1', 'evt_missing-sub')).rejects.toThrow(
      'Payment webhook does not match a persisted provider subscription'
    );
  });

  it('does nothing when the webhook inbox row no longer exists', async () => {
    const tx = { paymentWebhookEvent: { findFirst: vi.fn().mockResolvedValue(null) } };
    const provider = configuredProvider();
    const fetch = vi.spyOn(provider, 'fetchSubscription');
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );
    await service.processWebhookEvent('user_1', 'evt_missing');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('removes Premium when current Razorpay state is cancelled and treats duplicate notice as safe', async () => {
    const local = {
      id: 'local_1',
      userId: 'user_1',
      idempotencyKey: 'req_1',
      razorpayPlanId: 'plan_monthly',
      razorpaySubscriptionId: 'sub_123',
      status: 'active',
      currentStart: new Date(Date.now() - 60_000),
      currentEnd: new Date(Date.now() + 60_000),
    };
    const event = {
      id: 'event_1',
      userId: 'user_1',
      eventId: 'evt_1',
      idempotencyKey: 'req_1',
      subscriptionId: 'sub_123',
      processedAt: null,
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: { findFirst: vi.fn().mockResolvedValue(event), update: vi.fn() },
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(local),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({
          ...local,
          status: 'cancelled',
          currentEnd: null,
        }),
      },
    };
    const uniqueViolation = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      { code: 'P2002' }
    );
    const mongo = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'PREMIUM' }), update: vi.fn() },
      inAppNotification: { create: vi.fn().mockRejectedValue(uniqueViolation) },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'cancelled',
      updated_at: Math.floor((Date.now() + 10_000) / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
    });
    const service = new PaymentsService(
      mongo as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );
    await service.processWebhookEvent('user_1', 'evt_1');
    expect(mongo.user.update).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_1' },
      data: { role: 'USER' },
    });
    expect(tx.paymentWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event_1' },
        data: expect.objectContaining({ status: 'processed' }),
      })
    );
  });

  it('keeps Premium when a delayed terminal event belongs to an old subscription', async () => {
    const oldSubscription = {
      id: 'old_local',
      userId: 'user_1',
      idempotencyKey: 'old_request',
      razorpayPlanId: 'plan_monthly',
      razorpaySubscriptionId: 'sub_old',
      status: 'active',
      currentStart: new Date(Date.now() - 60_000),
      currentEnd: new Date(Date.now() + 60_000),
    };
    const event = {
      id: 'event_old',
      userId: 'user_1',
      eventId: 'evt_old',
      idempotencyKey: 'old_request',
      subscriptionId: 'sub_old',
      processedAt: null,
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: { findFirst: vi.fn().mockResolvedValue(event), update: vi.fn() },
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(oldSubscription),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { status: 'cancelled', currentStart: null, currentEnd: null },
          {
            status: 'active',
            currentStart: new Date(Date.now() - 1_000),
            currentEnd: new Date(Date.now() + 60_000),
          },
        ]),
      },
    };
    const mongo = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'PREMIUM' }), update: vi.fn() },
      inAppNotification: { create: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_old',
      plan_id: 'plan_monthly',
      status: 'cancelled',
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'old_request' },
    });
    const service = new PaymentsService(
      mongo as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await service.processWebhookEvent('user_1', 'evt_old');

    expect(mongo.user.update).not.toHaveBeenCalled();
    expect(mongo.inAppNotification.create).not.toHaveBeenCalled();
  });

  it('preserves the admin role for a valid active subscription', async () => {
    const local = {
      id: 'local_1',
      userId: 'user_1',
      idempotencyKey: 'req_1',
      razorpayPlanId: 'plan_monthly',
      razorpaySubscriptionId: 'sub_123',
      status: 'active',
      currentStart: new Date(Date.now() - 60_000),
      currentEnd: new Date(Date.now() + 60_000),
    };
    const event = {
      id: 'event_1',
      userId: 'user_1',
      eventId: 'evt_1',
      idempotencyKey: 'req_1',
      subscriptionId: 'sub_123',
      processedAt: null,
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: { findFirst: vi.fn().mockResolvedValue(event), update: vi.fn() },
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(local),
        findMany: vi.fn().mockResolvedValue([
          {
            status: 'active',
            currentStart: local.currentStart,
            currentEnd: local.currentEnd,
          },
        ]),
        update: vi.fn(),
      },
    };
    const mongo = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }), update: vi.fn() },
      inAppNotification: { create: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'active',
      updated_at: Math.floor((Date.now() - 1_000) / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
    });
    const service = new PaymentsService(
      mongo as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );
    await service.processWebhookEvent('user_1', 'evt_1');
    expect(mongo.user.update).not.toHaveBeenCalled();
    expect(mongo.inAppNotification.create).not.toHaveBeenCalled();
    expect(tx.paymentSubscription.update).toHaveBeenCalledOnce();
  });

  it('reconciles queued inbox events after a missed dispatch', async () => {
    const tx = { paymentWebhookEvent: { update: vi.fn() } };
    const client = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'event_1', eventId: 'evt_1', userId: 'user_1' }]),
      },
      paymentSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const jobs = { enqueue: vi.fn().mockResolvedValue('job_1') };
    const service = new PaymentsService(
      {} as never,
      { ...postgresFor(tx), client_: client } as never,
      configuredProvider(),
      jobs as never
    );

    await service.reconcilePendingPayments();

    expect(jobs.enqueue).toHaveBeenCalledWith(
      'payment-reconcile-queue',
      {
        idempotencyKey: 'evt_1',
        userId: 'user_1',
      },
      'reconcile-subscription',
      true
    );
    expect(tx.paymentWebhookEvent.update).toHaveBeenCalledOnce();
  });

  it('continues after redispatch failures and skips expired subscriptions without provider IDs', async () => {
    const expired = [
      {
        id: 'local_missing',
        userId: 'user_1',
        idempotencyKey: 'req_missing',
        razorpaySubscriptionId: null,
      },
      {
        id: 'local_unavailable',
        userId: 'user_2',
        idempotencyKey: 'req_2',
        razorpaySubscriptionId: 'sub_2',
        razorpayPlanId: 'plan_monthly',
      },
    ];
    const client = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'event_1', eventId: 'evt_1', userId: 'user_1' }]),
      },
      paymentSubscription: { findMany: vi.fn().mockResolvedValue(expired) },
    };
    const jobs = { enqueue: vi.fn().mockRejectedValue(new Error('Redis unavailable')) };
    const provider = configuredProvider();
    const fetch = vi
      .spyOn(provider, 'fetchSubscription')
      .mockRejectedValue(new Error('Razorpay unavailable'));
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi.fn().mockResolvedValue(expired[1]),
        findMany: vi.fn().mockResolvedValue([
          {
            status: 'active',
            currentStart: new Date(Date.now() - 120_000),
            currentEnd: new Date(Date.now() - 60_000),
          },
        ]),
      },
    };
    const mongo = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: 'PREMIUM' }), update: vi.fn() },
      inAppNotification: { create: vi.fn() },
    };
    const service = new PaymentsService(
      mongo as never,
      { ...postgresFor(tx), client_: client } as never,
      provider,
      jobs as never
    );

    await expect(service.reconcilePendingPayments()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('sub_2');
    expect(mongo.user.update).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_2' },
      data: { role: 'USER' },
    });
  });

  it('continues expiry reconciliation when one user profile cannot be projected', async () => {
    const expired = [
      {
        id: 'local_missing_profile',
        userId: 'user_missing_profile',
        idempotencyKey: 'req_missing_profile',
        razorpaySubscriptionId: 'sub_missing_profile',
      },
      {
        id: 'local_valid_profile',
        userId: 'user_valid_profile',
        idempotencyKey: 'req_valid_profile',
        razorpaySubscriptionId: 'sub_valid_profile',
      },
    ];
    const client = {
      $executeRaw: vi.fn(),
      paymentWebhookEvent: { findMany: vi.fn().mockResolvedValue([]) },
      paymentSubscription: { findMany: vi.fn().mockResolvedValue(expired) },
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findUnique: vi
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(expired.find((row) => row.id === where.id))
          ),
        findMany: vi.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.userId === 'user_valid_profile'
              ? [
                  {
                    status: 'active',
                    currentStart: new Date(Date.now() - 120_000),
                    currentEnd: new Date(Date.now() - 60_000),
                  },
                ]
              : []
          )
        ),
      },
    };
    const postgres = {
      ...postgresFor(tx),
      client_: client,
      withTenantContext: vi.fn(async (_userId, operation) => operation(tx)),
    };
    const mongo = {
      user: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ role: 'PREMIUM' }),
        update: vi.fn(),
      },
      inAppNotification: { create: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'fetchSubscription').mockRejectedValue(new Error('Razorpay unavailable'));
    const service = new PaymentsService(mongo as never, postgres as never, provider, {
      enqueue: vi.fn(),
    } as never);

    await expect(service.reconcilePendingPayments()).resolves.toBeUndefined();

    expect(postgres.withTenantContext).toHaveBeenCalledWith(
      'user_valid_profile',
      expect.any(Function)
    );
    expect(mongo.user.update).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_valid_profile' },
      data: { role: 'USER' },
    });
  });

  it('handles duplicate event inserts caused by concurrent webhook deliveries', async () => {
    const request = createWebhookRequest();
    const subscription = {
      id: 'local_1',
      userId: 'user_1',
      idempotencyKey: 'req_1',
      razorpayPlanId: 'plan_monthly',
      razorpaySubscriptionId: 'sub_123',
    };
    const prior = {
      id: 'event_1',
      userId: 'user_1',
      eventId: request.eventId,
      subscriptionId: 'sub_123',
    };
    const uniqueViolation = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      { code: 'P2002' }
    );
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findUnique: vi.fn().mockResolvedValue(subscription) },
      paymentWebhookEvent: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(prior),
        create: vi.fn().mockRejectedValue(uniqueViolation),
        update: vi.fn(),
      },
    };
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      configuredProvider(),
      { enqueue: vi.fn().mockResolvedValue('job_1') } as never
    );

    await expect(
      service.acceptWebhook(request.rawBody, request.signature, request.eventId)
    ).resolves.toEqual({ received: true });
    expect(tx.paymentWebhookEvent.create).toHaveBeenCalledOnce();
  });

  it('reconciles nothing when PostgreSQL has no API client', async () => {
    const service = new PaymentsService(
      {} as never,
      { client_: undefined } as never,
      configuredProvider(),
      {} as never
    );
    await expect(service.reconcilePendingPayments()).resolves.toBeUndefined();
  });

  it('deletes charge records strictly older than seven years', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2033-01-02T03:00:00.000Z'));
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new PaymentsService(
      {} as never,
      {
        client_: {
          paymentCharge: { deleteMany },
          paymentRefund: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
        },
      } as never,
      configuredProvider(),
      {} as never
    );

    await service.cleanupExpiredPaymentCharges();

    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-01-02T03:00:00.000Z') } },
    });
    vi.useRealTimers();
  });

  it('does not crash when charge retention cleanup fails', async () => {
    const service = new PaymentsService(
      {} as never,
      {
        client_: {
          paymentCharge: { deleteMany: vi.fn().mockRejectedValue(new Error('PostgreSQL down')) },
        },
      } as never,
      configuredProvider(),
      {} as never
    );

    await expect(service.cleanupExpiredPaymentCharges()).resolves.toBeUndefined();
  });
});

describe('PaymentsService subscription cancellation', () => {
  const activeSubscription = () => ({
    id: 'local_1',
    userId: 'user_1',
    idempotencyKey: 'request-1',
    planKey: 'monthly',
    razorpayPlanId: 'plan_monthly',
    razorpaySubscriptionId: 'sub_123',
    status: 'active',
    shortUrl: null,
    currentStart: new Date(Date.now() - 60_000),
    currentEnd: new Date(Date.now() + 60_000),
    createdAt: new Date('2026-11-04T00:00:00Z'),
    cancelAtPeriodEnd: false,
  });

  it('schedules end-of-cycle cancellation for the authenticated user and retains paid access', async () => {
    const row = activeSubscription();
    const scheduled = { ...row, status: 'active', cancelAtPeriodEnd: true };
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findFirst: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockResolvedValue(scheduled),
        findMany: vi.fn().mockResolvedValue([scheduled]),
      },
    };
    const provider = configuredProvider();
    const cancel = vi.spyOn(provider, 'cancelSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'active',
      has_scheduled_changes: true,
      current_start: Math.floor(row.currentStart.getTime() / 1000),
      current_end: Math.floor(row.currentEnd.getTime() / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request-1' },
    });
    const mongo = { user: { findUnique: vi.fn().mockResolvedValue({ role: 'PREMIUM' }) } };
    const service = new PaymentsService(
      mongo as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).resolves.toMatchObject({
      id: 'local_1',
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: row.currentEnd,
    });
    expect(cancel).toHaveBeenCalledWith('sub_123');
    expect(tx.paymentSubscription.update).toHaveBeenCalledWith({
      where: { id: 'local_1' },
      data: expect.objectContaining({ status: 'active', cancelAtPeriodEnd: true }),
    });
    expect(mongo.user.findUnique).toHaveBeenCalledOnce();
  });

  it('returns an already scheduled cancellation without calling Razorpay again', async () => {
    const scheduled = { ...activeSubscription(), status: 'active', cancelAtPeriodEnd: true };
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findFirst: vi.fn().mockResolvedValue(scheduled),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([scheduled]),
      },
    };
    const provider = configuredProvider();
    const cancel = vi.spyOn(provider, 'cancelSubscription');
    const service = new PaymentsService(
      { user: { findUnique: vi.fn().mockResolvedValue({ role: 'PREMIUM' }) } } as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).resolves.toMatchObject({
      cancelAtPeriodEnd: true,
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('rejects subscriptions without a current paid active period before contacting Razorpay', async () => {
    const row = {
      ...activeSubscription(),
      status: 'halted',
      currentEnd: new Date(Date.now() + 60_000),
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findFirst: vi.fn().mockResolvedValue(row), update: vi.fn() },
    };
    const provider = configuredProvider();
    const cancel = vi.spyOn(provider, 'cancelSubscription');
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).rejects.toThrow(ConflictException);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('recovers an ambiguous provider cancellation when a fresh fetch shows a future canceled period', async () => {
    const row = activeSubscription();
    const scheduled = { ...row, status: 'cancelled', cancelAtPeriodEnd: true };
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findFirst: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockResolvedValue(scheduled),
        findMany: vi.fn().mockResolvedValue([scheduled]),
      },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'cancelSubscription').mockRejectedValue(new Error('response timed out'));
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'cancelled',
      current_start: Math.floor(row.currentStart.getTime() / 1000),
      current_end: Math.floor(row.currentEnd.getTime() / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request-1' },
    });
    const mongo = { user: { findUnique: vi.fn().mockResolvedValue({ role: 'PREMIUM' }) } };
    const service = new PaymentsService(
      mongo as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).resolves.toMatchObject({
      cancelAtPeriodEnd: true,
      status: 'cancelled',
    });
    expect(provider.fetchSubscription).toHaveBeenCalledWith('sub_123');
  });

  it('does not persist a provider response that identifies a different subscription', async () => {
    const row = activeSubscription();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: {
        findFirst: vi.fn().mockResolvedValue(row),
        update: vi.fn(),
      },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'cancelSubscription').mockResolvedValue({
      id: 'sub_other',
      plan_id: 'plan_monthly',
      status: 'active',
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request-1' },
    });
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentSubscription.update).not.toHaveBeenCalled();
  });

  it('rejects an unexpected provider status after cancellation', async () => {
    const row = activeSubscription();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findFirst: vi.fn().mockResolvedValue(row), update: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'cancelSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'created',
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request-1' },
    });
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentSubscription.update).not.toHaveBeenCalled();
  });

  it('does not mistake an unrelated scheduled provider change for a cancellation', async () => {
    const row = activeSubscription();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findFirst: vi.fn().mockResolvedValue(row), update: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'cancelSubscription').mockRejectedValue(new Error('response timed out'));
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'active',
      has_scheduled_changes: true,
      current_end: Math.floor(row.currentEnd.getTime() / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request-1' },
    });
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentSubscription.update).not.toHaveBeenCalled();
  });

  it('does not confirm a cancellation after the paid period has already ended', async () => {
    const row = activeSubscription();
    const tx = {
      $executeRaw: vi.fn(),
      paymentSubscription: { findFirst: vi.fn().mockResolvedValue(row), update: vi.fn() },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'cancelSubscription').mockRejectedValue(new Error('response timed out'));
    vi.spyOn(provider, 'fetchSubscription').mockResolvedValue({
      id: 'sub_123',
      plan_id: 'plan_monthly',
      status: 'cancelled',
      current_end: Math.floor((Date.now() - 60_000) / 1000),
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request-1' },
    });
    const service = new PaymentsService(
      {} as never,
      postgresFor(tx) as never,
      provider,
      {} as never
    );

    await expect(service.cancelCurrentSubscription('user_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentSubscription.update).not.toHaveBeenCalled();
  });

  it('reports missing subscriptions and disabled provider configuration explicitly', async () => {
    const provider = configuredProvider();
    const noSubscription = new PaymentsService(
      {} as never,
      postgresFor({
        $executeRaw: vi.fn(),
        paymentSubscription: { findFirst: vi.fn().mockResolvedValue(null) },
      }) as never,
      provider,
      {} as never
    );
    await expect(noSubscription.cancelCurrentSubscription('user_1')).rejects.toThrow(
      NotFoundException
    );

    const disabled = new PaymentsService(
      {} as never,
      {} as never,
      new RazorpayProvider({ get: () => undefined } as unknown as ConfigService),
      {} as never
    );
    await expect(disabled.cancelCurrentSubscription('user_1')).rejects.toThrow(
      ServiceUnavailableException
    );
  });
});

describe('PaymentsService full refunds', () => {
  const charge = {
    id: 'charge_1',
    userId: 'owner_1',
    subscriptionId: 'local_subscription_1',
    razorpaySubscriptionId: 'sub_1',
    razorpayPaymentId: 'pay_1',
    amountMinor: 49900,
    currency: 'INR',
  };
  const refundIntent = {
    id: 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf',
    chargeId: charge.id,
    userId: charge.userId,
    initiatedByUserId: 'admin_1',
    razorpayPaymentId: charge.razorpayPaymentId,
    razorpayRefundId: null,
    amountMinor: charge.amountMinor,
    currency: charge.currency,
    status: 'requested',
    failureCode: null,
    providerCreatedAt: null,
    createdAt: new Date('2026-11-04T00:00:00Z'),
  };

  const setup = (existingRefund: Record<string, unknown> | null = null) => {
    const tx = {
      $executeRaw: vi.fn(),
      paymentCharge: { findFirst: vi.fn().mockResolvedValue(charge) },
      paymentRefund: {
        findUnique: vi.fn().mockResolvedValue(existingRefund),
        create: vi.fn().mockResolvedValue(refundIntent),
        update: vi.fn().mockResolvedValue({
          ...refundIntent,
          razorpayRefundId: 'rfnd_1',
          status: 'pending',
          providerCreatedAt: new Date(1793793600 * 1000),
        }),
      },
    };
    const global = { paymentCharge: { findUnique: vi.fn().mockResolvedValue(charge) } };
    const postgres = {
      ...postgresFor(tx),
      client_: global,
    };
    const provider = configuredProvider();
    const refund = vi.spyOn(provider, 'refundPayment').mockResolvedValue({
      id: 'rfnd_1',
      payment_id: 'pay_1',
      amount: 49900,
      currency: 'INR',
      status: 'pending',
      created_at: 1793793600,
    });
    return {
      tx,
      global,
      postgres,
      provider,
      refund,
      service: new PaymentsService({} as never, postgres as never, provider, {} as never),
    };
  };

  it('skips refund reconciliation and retention cleanup when PostgreSQL is unavailable', async () => {
    const service = new PaymentsService(
      {} as never,
      { client_: undefined } as never,
      configuredProvider(),
      {} as never
    );

    await expect(service.reconcilePendingRefunds()).resolves.toBeUndefined();
    await expect(service.cleanupExpiredPaymentCharges()).resolves.toBeUndefined();
  });

  it('issues a full refund from the stored captured charge with a stable provider idempotency key', async () => {
    const { tx, provider, refund, service } = setup();

    await expect(service.initiateFullRefund(charge.id, 'admin_1')).resolves.toMatchObject({
      chargeId: charge.id,
      amountMinor: 49900,
      currency: 'INR',
      status: 'pending',
      razorpayRefundId: 'rfnd_1',
    });
    expect(tx.paymentRefund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chargeId: charge.id,
        userId: 'owner_1',
        initiatedByUserId: 'admin_1',
        razorpayPaymentId: 'pay_1',
        amountMinor: 49900,
        currency: 'INR',
        status: 'requested',
      }),
    });
    expect(refund).toHaveBeenCalledWith('pay_1', refundIntent.id);
  });

  it('returns a completed full refund without issuing a second provider request', async () => {
    const existing = {
      ...refundIntent,
      razorpayRefundId: 'rfnd_1',
      status: 'processed',
      providerCreatedAt: new Date('2026-11-04T01:00:00Z'),
    };
    const { tx, refund, service } = setup(existing);

    await expect(service.initiateFullRefund(charge.id, 'admin_2')).resolves.toMatchObject({
      status: 'processed',
      razorpayRefundId: 'rfnd_1',
    });
    expect(tx.paymentRefund.create).not.toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
  });

  it('reuses an existing pending refund intent with the same provider key', async () => {
    const { refund, service } = setup(refundIntent);

    await expect(service.initiateFullRefund(charge.id, 'admin_2')).resolves.toMatchObject({
      status: 'pending',
      razorpayRefundId: 'rfnd_1',
    });
    expect(refund).toHaveBeenCalledWith('pay_1', refundIntent.id);
  });

  it('leaves a timed-out refund request retryable with its original idempotency key', async () => {
    const { tx, refund, service } = setup();
    refund.mockRejectedValueOnce(new Error('network timeout'));

    await expect(service.initiateFullRefund(charge.id, 'admin_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentRefund.create).toHaveBeenCalledOnce();
    expect(tx.paymentRefund.update).not.toHaveBeenCalled();
  });

  it('does not attempt a refund when the captured charge does not exist', async () => {
    const { postgres, provider, service } = setup();
    vi.mocked(postgres.client_!.paymentCharge.findUnique).mockResolvedValueOnce(null as never);

    await expect(service.initiateFullRefund('unknown_charge', 'admin_1')).rejects.toThrow(
      NotFoundException
    );
    expect(provider.refundPayment).not.toHaveBeenCalled();
  });

  it('keeps a refund pending when Razorpay returns a mismatched payment or amount', async () => {
    const { tx, refund, service } = setup();
    refund.mockResolvedValueOnce({
      id: 'rfnd_wrong',
      payment_id: 'pay_other',
      amount: 1,
      currency: 'INR',
      status: 'processed',
      created_at: 1793793600,
    });

    await expect(service.initiateFullRefund(charge.id, 'admin_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentRefund.update).not.toHaveBeenCalled();
  });

  it('links the exact full refund when Razorpay reports an idempotency conflict', async () => {
    const { tx, provider, refund, service } = setup();
    refund.mockRejectedValueOnce(new RazorpayApiError(400, 'BAD_REQUEST_ERROR', 'rejected'));
    vi.spyOn(provider, 'fetchRefundsForPayment').mockResolvedValue([
      {
        id: 'rfnd_existing',
        payment_id: 'pay_1',
        amount: 49900,
        currency: 'INR',
        status: 'processed',
        created_at: 1793793600,
      },
    ]);
    tx.paymentRefund.update.mockResolvedValueOnce({
      ...refundIntent,
      razorpayRefundId: 'rfnd_existing',
      status: 'processed',
      providerCreatedAt: new Date(1793793600 * 1000),
    });

    await expect(service.initiateFullRefund(charge.id, 'admin_1')).resolves.toMatchObject({
      status: 'processed',
      razorpayRefundId: 'rfnd_existing',
    });
    expect(tx.paymentRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'processed' }) })
    );
  });

  it('keeps a provider rejection retryable when no full refund exists yet', async () => {
    const { tx, provider, refund, service } = setup();
    refund.mockRejectedValueOnce(new RazorpayApiError(400, 'BAD_REQUEST_ERROR', 'rejected'));
    vi.spyOn(provider, 'fetchRefundsForPayment').mockResolvedValue([]);

    await expect(service.initiateFullRefund(charge.id, 'admin_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentRefund.update).toHaveBeenCalledWith({
      where: { id: refundIntent.id },
      data: expect.objectContaining({ status: 'requested', failureCode: 'PROVIDER_RETRYABLE' }),
    });
    tx.paymentRefund.findUnique.mockResolvedValue(refundIntent);
    await expect(service.initiateFullRefund(charge.id, 'admin_1')).resolves.toMatchObject({
      status: 'pending',
    });
    expect(refund).toHaveBeenNthCalledWith(2, 'pay_1', refundIntent.id);
  });

  it('leaves a request recoverable when Razorpay cannot list refunds after a conflict', async () => {
    const { tx, provider, refund, service } = setup();
    refund.mockRejectedValueOnce(new RazorpayApiError(400, 'BAD_REQUEST_ERROR', 'rejected'));
    vi.spyOn(provider, 'fetchRefundsForPayment').mockRejectedValueOnce(new Error('network error'));

    await expect(service.initiateFullRefund(charge.id, 'admin_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(tx.paymentRefund.update).not.toHaveBeenCalled();
  });

  it('reconciles pending refunds using the persisted provider refund ID', async () => {
    const pending = {
      id: refundIntent.id,
      userId: charge.userId,
      razorpayPaymentId: charge.razorpayPaymentId,
      razorpayRefundId: 'rfnd_1',
      amountMinor: charge.amountMinor,
      currency: charge.currency,
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentRefund: {
        update: vi.fn().mockResolvedValue({ ...refundIntent, status: 'processed' }),
      },
    };
    const provider = configuredProvider();
    const fetchRefund = vi.spyOn(provider, 'fetchRefund').mockResolvedValue({
      id: 'rfnd_1',
      payment_id: 'pay_1',
      amount: 49900,
      currency: 'INR',
      status: 'processed',
      created_at: 1793793600,
    });
    const postgres = {
      ...postgresFor(tx),
      client_: { paymentRefund: { findMany: vi.fn().mockResolvedValue([pending]) } },
    };
    const service = new PaymentsService({} as never, postgres as never, provider, {} as never);

    await service.reconcilePendingRefunds();

    expect(fetchRefund).toHaveBeenCalledWith('rfnd_1');
    expect(tx.paymentRefund.update).toHaveBeenCalledWith({
      where: { id: refundIntent.id },
      data: expect.objectContaining({ status: 'processed', razorpayRefundId: 'rfnd_1' }),
    });
    expect(
      tx.$executeRaw.mock.calls.some((call: unknown[]) =>
        String((call[0] as TemplateStringsArray).join(' ')).includes('prepai_append_audit_log')
      )
    ).toBe(true);
  });

  it('links an existing full refund found after a retry conflict in the reconciliation worker', async () => {
    const pending = {
      id: refundIntent.id,
      userId: charge.userId,
      razorpayPaymentId: charge.razorpayPaymentId,
      razorpayRefundId: null,
      amountMinor: charge.amountMinor,
      currency: charge.currency,
    };
    const tx = {
      $executeRaw: vi.fn(),
      paymentRefund: {
        update: vi.fn().mockResolvedValue({ ...refundIntent, status: 'processed' }),
      },
    };
    const provider = configuredProvider();
    vi.spyOn(provider, 'refundPayment').mockRejectedValueOnce(
      new RazorpayApiError(400, 'BAD_REQUEST_ERROR', 'already refunded')
    );
    const listRefunds = vi.spyOn(provider, 'fetchRefundsForPayment').mockResolvedValue([
      {
        id: 'rfnd_dashboard',
        payment_id: 'pay_1',
        amount: 49900,
        currency: 'INR',
        status: 'processed',
        created_at: 1793793600,
      },
    ]);
    const postgres = {
      ...postgresFor(tx),
      client_: { paymentRefund: { findMany: vi.fn().mockResolvedValue([pending]) } },
    };
    const service = new PaymentsService({} as never, postgres as never, provider, {} as never);

    await service.reconcilePendingRefunds();

    expect(listRefunds).toHaveBeenCalledWith('pay_1');
    expect(tx.paymentRefund.update).toHaveBeenCalledWith({
      where: { id: refundIntent.id },
      data: expect.objectContaining({
        status: 'processed',
        razorpayRefundId: 'rfnd_dashboard',
      }),
    });
  });

  it('queries the oldest updated pending refunds first so repeated retries rotate through batches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new PaymentsService(
      {} as never,
      { client_: { paymentRefund: { findMany } } } as never,
      configuredProvider(),
      {} as never
    );

    await service.reconcilePendingRefunds();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 100,
      })
    );
  });
});
