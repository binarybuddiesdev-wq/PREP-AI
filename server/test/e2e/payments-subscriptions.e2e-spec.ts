import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { RazorpayProvider } from '../../src/modules/payments/razorpay-provider.js';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('Razorpay subscription persistence and role projection', () => {
  let database: TDatabase | undefined;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
  }, 30_000);

  afterAll(async () => {
    if (database) await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('persists a subscription, deduplicates a signed webhook, and grants Premium from provider state', async () => {
    const suffix = randomUUID();
    const userId = `razorpay-test-${suffix}`;
    const email = `${userId}@test.invalid`;
    const idempotencyKey = `subscribe-${suffix}`;
    const eventId = `evt-${suffix}`;
    const providerSubscriptionId = `sub_${suffix.replaceAll('-', '')}`;
    const webhookSecret = 'integration-webhook-secret';
    const user = await database!.mongo.user.create({
      data: { clerkUserId: userId, email, name: 'Razorpay Integration', role: 'USER' },
    });
    const values: Record<string, string> = {
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'rzp_test_secret',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_test_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_test_yearly',
      RAZORPAY_WEBHOOK_SECRET: webhookSecret,
    };
    const provider = new RazorpayProvider({
      get: (key: string) => values[key],
    } as unknown as ConfigService);
    const now = Math.floor(Date.now() / 1000);
    const remote = {
      id: providerSubscriptionId,
      plan_id: 'plan_test_monthly',
      status: 'active',
      current_start: now - 60,
      current_end: now + 3_600,
      updated_at: now + 1,
      notes: { prepai_user_id: userId, prepai_request_id: idempotencyKey },
    };
    vi.spyOn(provider, 'createSubscription').mockResolvedValue({
      id: providerSubscriptionId,
      plan_id: 'plan_test_monthly',
      status: 'created',
      short_url: 'https://rzp.io/i/test',
      notes: remote.notes,
    });
    const fetchSubscription = vi.spyOn(provider, 'fetchSubscription').mockResolvedValue(remote);
    const jobs = { enqueue: vi.fn().mockResolvedValue('job_1') };
    const service = new PaymentsService(
      database!.mongo,
      database!.postgresProvider,
      provider,
      jobs as never
    );

    try {
      const started = await service.startSubscription(userId, { plan: 'monthly' }, idempotencyKey);
      expect(started.checkoutUrl).toBe('https://rzp.io/i/test');

      const eventBody = Buffer.from(
        JSON.stringify({
          event: 'subscription.activated',
          created_at: now,
          payload: {
            subscription: {
              entity: {
                id: providerSubscriptionId,
                plan_id: 'plan_test_monthly',
                status: 'active',
                updated_at: now + 1,
                current_start: now - 60,
                current_end: now + 3_600,
                notes: { prepai_user_id: userId, prepai_request_id: idempotencyKey },
              },
            },
          },
        })
      );
      const signature = createHmac('sha256', webhookSecret).update(eventBody).digest('hex');
      await expect(service.acceptWebhook(eventBody, signature, eventId)).resolves.toEqual({
        received: true,
      });
      await expect(service.acceptWebhook(eventBody, signature, eventId)).resolves.toEqual({
        received: true,
      });
      expect(jobs.enqueue).toHaveBeenCalledTimes(2);

      await service.processWebhookEvent(userId, eventId);

      await expect(
        database!.mongo.user.findUnique({ where: { clerkUserId: userId } })
      ).resolves.toMatchObject({ role: 'PREMIUM' });
      await expect(
        database!.mongo.inAppNotification.findFirst({
          where: { userId, category: 'billing' },
        })
      ).resolves.toMatchObject({
        category: 'billing',
        idempotencyKey: expect.stringContaining(`subscription-role:${userId}:PREMIUM:`),
      });
      const saved = await database!.postgresProvider.withTenantContext(userId, async (tx) => {
        const subscription = await tx.paymentSubscription.findFirst({
          where: { userId, idempotencyKey },
        });
        const inbox = await tx.paymentWebhookEvent.findUnique({ where: { eventId } });
        return { subscription, inbox };
      });
      expect(saved.subscription).toMatchObject({
        status: 'active',
        razorpaySubscriptionId: providerSubscriptionId,
      });
      expect(saved.inbox).toMatchObject({ status: 'processed', attempts: 2 });

      await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentSubscription.update({
          where: { id: started.id },
          data: { currentEnd: new Date(Date.now() - 60_000) },
        })
      );
      fetchSubscription.mockRejectedValueOnce(new Error('Razorpay unavailable'));
      await service.reconcilePendingPayments();
      await expect(
        database!.mongo.user.findUnique({ where: { clerkUserId: userId } })
      ).resolves.toMatchObject({ role: 'USER' });
      fetchSubscription.mockResolvedValue({
        ...remote,
        current_start: now - 60,
        current_end: now + 3_600,
      });
      await service.reconcilePendingPayments();
      await expect(
        database!.mongo.user.findUnique({ where: { clerkUserId: userId } })
      ).resolves.toMatchObject({ role: 'PREMIUM' });
      await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentSubscription.update({
          where: { id: started.id },
          data: { currentEnd: new Date(Date.now() - 60_000) },
        })
      );
      fetchSubscription.mockResolvedValue({
        ...remote,
        status: 'completed',
        current_end: now - 1,
        updated_at: now + 20,
      });
      await service.reconcilePendingPayments();
      await expect(
        database!.mongo.user.findUnique({ where: { clerkUserId: userId } })
      ).resolves.toMatchObject({ role: 'USER' });
      await expect(
        database!.postgresProvider.withTenantContext(userId, (tx) =>
          tx.paymentSubscription.findUnique({ where: { id: started.id } })
        )
      ).resolves.toMatchObject({ status: 'completed' });
    } finally {
      await database!.postgresProvider.withTenantContext(userId, async (tx) => {
        await tx.paymentWebhookEvent.deleteMany({ where: { userId } });
        await tx.paymentSubscription.deleteMany({ where: { userId } });
      });
      await database!.mongo.inAppNotification.deleteMany({ where: { userId } });
      await database!.mongo.user.delete({ where: { id: user.id } });
    }
  });
});
