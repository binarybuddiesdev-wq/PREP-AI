import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
  withTestUserContext,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;
type TPaymentRows = {
  subscriptionId: string;
  eventId: string;
  chargeId: string;
  refundId: string;
};

describe('PostgreSQL payment data isolation', () => {
  let database: TDatabase | undefined;
  const fixtureId = randomUUID();
  const userA = `payment-isolation-a-${fixtureId}`;
  const userB = `payment-isolation-b-${fixtureId}`;
  const rowsA: TPaymentRows = {
    subscriptionId: randomUUID(),
    eventId: randomUUID(),
    chargeId: randomUUID(),
    refundId: randomUUID(),
  };
  const rowsB: TPaymentRows = {
    subscriptionId: randomUUID(),
    eventId: randomUUID(),
    chargeId: randomUUID(),
    refundId: randomUUID(),
  };

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    await Promise.all([createPaymentRows(userA, rowsA, 'a'), createPaymentRows(userB, rowsB, 'b')]);
  }, 30_000);

  afterAll(async () => {
    if (!database) return;
    await Promise.all([userA, userB].map((userId) => deletePaymentRows(userId)));
    await disconnectIsolationTestDatabases(database);
  }, 30_000);

  async function createPaymentRows(userId: string, ids: TPaymentRows, suffix: string) {
    return withTestUserContext(database!, userId, async (transaction) => {
      await transaction.paymentSubscription.create({
        data: {
          id: ids.subscriptionId,
          userId,
          idempotencyKey: `subscription-${suffix}`,
          planKey: 'monthly',
          razorpayPlanId: `plan-${suffix}`,
        },
      });
      await transaction.paymentWebhookEvent.create({
        data: {
          id: ids.eventId,
          userId,
          eventId: `event-${suffix}-${fixtureId}`,
          eventType: 'subscription.activated',
          subscriptionId: `provider-subscription-${suffix}`,
          idempotencyKey: `subscription-${suffix}`,
          occurredAt: new Date(),
        },
      });
      await transaction.paymentCharge.create({
        data: {
          id: ids.chargeId,
          userId,
          subscriptionId: ids.subscriptionId,
          razorpaySubscriptionId: `provider-subscription-${suffix}`,
          razorpayPaymentId: `payment-${suffix}-${fixtureId}`,
          amountMinor: 1_000,
          currency: 'INR',
          chargedAt: new Date(),
        },
      });
      await transaction.paymentRefund.create({
        data: {
          id: ids.refundId,
          chargeId: ids.chargeId,
          userId,
          initiatedByUserId: userId,
          razorpayPaymentId: `payment-${suffix}-${fixtureId}`,
          amountMinor: 1_000,
          currency: 'INR',
        },
      });
    });
  }

  async function deletePaymentRows(userId: string) {
    return withTestUserContext(database!, userId, async (transaction) => {
      await transaction.paymentRefund.deleteMany({ where: { userId } });
      await transaction.paymentCharge.deleteMany({ where: { userId } });
      await transaction.paymentWebhookEvent.deleteMany({ where: { userId } });
      await transaction.paymentSubscription.deleteMany({ where: { userId } });
    });
  }

  it('shows each tenant only its own subscriptions, events, charges, and refunds', async () => {
    for (const [userId, expected] of [
      [userA, rowsA],
      [userB, rowsB],
    ] as const) {
      const actual = await withTestUserContext(database!, userId, async (transaction) => {
        const [subscriptions, events, charges, refunds] = await Promise.all([
          transaction.paymentSubscription.findMany({}),
          transaction.paymentWebhookEvent.findMany({}),
          transaction.paymentCharge.findMany({}),
          transaction.paymentRefund.findMany({}),
        ]);
        return {
          subscriptionIds: subscriptions.map(({ id }) => id),
          eventIds: events.map(({ id }) => id),
          chargeIds: charges.map(({ id }) => id),
          refundIds: refunds.map(({ id }) => id),
        };
      });

      expect(actual).toEqual({
        subscriptionIds: [expected.subscriptionId],
        eventIds: [expected.eventId],
        chargeIds: [expected.chargeId],
        refundIds: [expected.refundId],
      });
    }
  });

  it('prevents a tenant from updating another tenant payment rows by ID', async () => {
    const counts = await withTestUserContext(database!, userB, async (transaction) => {
      const [subscription, event, charge, refund] = await Promise.all([
        transaction.paymentSubscription.updateMany({
          where: { id: rowsA.subscriptionId },
          data: { status: 'tampered' },
        }),
        transaction.paymentWebhookEvent.updateMany({
          where: { id: rowsA.eventId },
          data: { status: 'tampered' },
        }),
        transaction.paymentCharge.updateMany({
          where: { id: rowsA.chargeId },
          data: { invoiceId: 'tampered' },
        }),
        transaction.paymentRefund.updateMany({
          where: { id: rowsA.refundId },
          data: { status: 'tampered' },
        }),
      ]);
      return [subscription.count, event.count, charge.count, refund.count];
    });

    expect(counts).toEqual([0, 0, 0, 0]);
    const ownerStatus = await withTestUserContext(database!, userA, async (transaction) => {
      const [subscription, event, charge, refund] = await Promise.all([
        transaction.paymentSubscription.findUnique({ where: { id: rowsA.subscriptionId } }),
        transaction.paymentWebhookEvent.findUnique({ where: { id: rowsA.eventId } }),
        transaction.paymentCharge.findUnique({ where: { id: rowsA.chargeId } }),
        transaction.paymentRefund.findUnique({ where: { id: rowsA.refundId } }),
      ]);
      return [subscription?.status, event?.status, charge?.invoiceId, refund?.status];
    });
    expect(ownerStatus).not.toContain('tampered');
  });

  it('returns no payment rows when the API transaction has no tenant context', async () => {
    const client = database!.postgresProvider.client_!;
    const [subscriptions, events, charges, refunds] = await Promise.all([
      client.paymentSubscription.findMany({}),
      client.paymentWebhookEvent.findMany({}),
      client.paymentCharge.findMany({}),
      client.paymentRefund.findMany({}),
    ]);

    expect(subscriptions).toEqual([]);
    expect(events).toEqual([]);
    expect(charges).toEqual([]);
    expect(refunds).toEqual([]);
  });

  it('allows guarded admins to find charges across tenants but keeps refunds owner-scoped', async () => {
    const adminId = `payment-admin-${fixtureId}`;
    const adminView = await database!.postgresProvider.withAdminContext(adminId, async (tx) => ({
      charge: await tx.paymentCharge.findUnique({ where: { id: rowsA.chargeId } }),
      refund: await tx.paymentRefund.findUnique({ where: { id: rowsA.refundId } }),
    }));

    expect(adminView.charge?.id).toBe(rowsA.chargeId);
    expect(adminView.refund).toBeNull();
  });

  it('scopes worker payment mutations to the requested tenant and operation', async () => {
    const providerEventId = `event-a-${fixtureId}`;
    const visibleEvent = await database!.postgresProvider.withWorkerTenantContext(
      userA,
      providerEventId,
      (tx) => tx.paymentWebhookEvent.findUnique({ where: { id: rowsA.eventId } })
    );
    const hiddenEvent = await database!.postgresProvider.withWorkerTenantContext(
      userB,
      providerEventId,
      (tx) => tx.paymentWebhookEvent.findUnique({ where: { id: rowsA.eventId } })
    );
    const visibleRefund = await database!.postgresProvider.withWorkerTenantContext(
      userA,
      rowsA.refundId,
      (tx) => tx.paymentRefund.findUnique({ where: { id: rowsA.refundId } })
    );
    const hiddenRefund = await database!.postgresProvider.withWorkerTenantContext(
      userB,
      rowsA.refundId,
      (tx) => tx.paymentRefund.findUnique({ where: { id: rowsA.refundId } })
    );

    expect(visibleEvent?.id).toBe(rowsA.eventId);
    expect(hiddenEvent).toBeNull();
    expect(visibleRefund?.id).toBe(rowsA.refundId);
    expect(hiddenRefund).toBeNull();
  });

  it('does not let the API role invoke payment worker functions', async () => {
    await expect(
      database!.postgres
        .$queryRaw`SELECT * FROM public.prepai_claim_pending_payment_refunds(10::integer)`
    ).rejects.toThrow(/permission denied/i);
  });
});
