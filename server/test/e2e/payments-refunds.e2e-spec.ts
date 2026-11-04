import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { RazorpayProvider } from '../../src/modules/payments/razorpay-provider.js';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('Razorpay refund persistence and idempotency', () => {
  let database: TDatabase | undefined;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
  }, 30_000);

  afterAll(async () => {
    if (database) await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('commits one refund intent under concurrent requests and reuses its provider key', async () => {
    const suffix = randomUUID();
    const userId = `refund-test-${suffix}`;
    const chargeId = randomUUID();
    const paymentId = `pay_${suffix.replaceAll('-', '')}`;
    const refundId = `rfnd_${suffix.replaceAll('-', '')}`;

    await database!.postgresProvider.withTenantContext(userId, (tx) =>
      tx.paymentCharge.create({
        data: {
          id: chargeId,
          userId,
          subscriptionId: randomUUID(),
          razorpaySubscriptionId: `sub_${suffix.replaceAll('-', '')}`,
          razorpayPaymentId: paymentId,
          amountMinor: 49900,
          currency: 'INR',
          chargedAt: new Date(),
        },
      })
    );

    const provider = new RazorpayProvider({ get: () => undefined } as unknown as ConfigService);
    const refundPayment = vi.spyOn(provider, 'refundPayment').mockResolvedValue({
      id: refundId,
      payment_id: paymentId,
      amount: 49900,
      currency: 'INR',
      status: 'pending',
      created_at: Math.floor(Date.now() / 1000),
    });
    const service = new PaymentsService(
      database!.mongo,
      database!.postgresProvider,
      provider,
      {} as never
    );

    try {
      const results = await Promise.all([
        service.initiateFullRefund(chargeId, 'admin_a'),
        service.initiateFullRefund(chargeId, 'admin_b'),
      ]);
      const saved = await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentRefund.findUnique({ where: { chargeId } })
      );

      expect(saved).toMatchObject({
        chargeId,
        userId,
        razorpayPaymentId: paymentId,
        amountMinor: 49900,
        currency: 'INR',
        status: 'pending',
        razorpayRefundId: refundId,
      });
      expect(results).toHaveLength(2);
      expect(refundPayment).toHaveBeenCalled();
      expect(new Set(refundPayment.mock.calls.map(([, key]) => key))).toEqual(new Set([saved!.id]));
    } finally {
      await database!.postgresProvider.withTenantContext(userId, async (tx) => {
        await tx.paymentRefund.deleteMany({ where: { chargeId } });
        await tx.paymentCharge.deleteMany({ where: { id: chargeId } });
      });
    }
  });

  it('retains charges and refunds independently according to their own seven-year age', async () => {
    const suffix = randomUUID();
    const userId = `refund-retention-${suffix}`;
    const oldChargeId = randomUUID();
    const recentChargeId = randomUUID();
    const oldPaymentId = `pay_old_${suffix.replaceAll('-', '')}`;
    const recentPaymentId = `pay_new_${suffix.replaceAll('-', '')}`;
    const oldDate = new Date('2018-01-01T00:00:00.000Z');
    const now = new Date();
    const provider = new RazorpayProvider({ get: () => undefined } as unknown as ConfigService);
    const service = new PaymentsService(
      database!.mongo,
      database!.postgresProvider,
      provider,
      {} as never
    );

    await database!.postgresProvider.withTenantContext(userId, async (tx) => {
      await tx.paymentCharge.createMany({
        data: [
          {
            id: oldChargeId,
            userId,
            subscriptionId: randomUUID(),
            razorpaySubscriptionId: `sub_old_${suffix.replaceAll('-', '')}`,
            razorpayPaymentId: oldPaymentId,
            amountMinor: 49900,
            currency: 'INR',
            chargedAt: oldDate,
            createdAt: oldDate,
          },
          {
            id: recentChargeId,
            userId,
            subscriptionId: randomUUID(),
            razorpaySubscriptionId: `sub_new_${suffix.replaceAll('-', '')}`,
            razorpayPaymentId: recentPaymentId,
            amountMinor: 49900,
            currency: 'INR',
            chargedAt: now,
            createdAt: now,
          },
        ],
      });
      await tx.paymentRefund.createMany({
        data: [
          {
            chargeId: oldChargeId,
            userId,
            initiatedByUserId: 'admin_test',
            razorpayPaymentId: oldPaymentId,
            amountMinor: 49900,
            currency: 'INR',
            status: 'processed',
            createdAt: now,
          },
          {
            chargeId: recentChargeId,
            userId,
            initiatedByUserId: 'admin_test',
            razorpayPaymentId: recentPaymentId,
            amountMinor: 49900,
            currency: 'INR',
            status: 'failed',
            createdAt: oldDate,
          },
        ],
      });
    });

    try {
      await service.cleanupExpiredPaymentCharges();
      const retained = await database!.postgresProvider.withTenantContext(userId, async (tx) => ({
        charge: await tx.paymentCharge.findMany({ where: { userId }, select: { id: true } }),
        refund: await tx.paymentRefund.findMany({ where: { userId }, select: { chargeId: true } }),
      }));

      expect(retained.charge.map(({ id }) => id)).toEqual([recentChargeId]);
      expect(retained.refund.map(({ chargeId: retainedChargeId }) => retainedChargeId)).toEqual([
        oldChargeId,
      ]);
    } finally {
      await database!.postgresProvider.withTenantContext(userId, async (tx) => {
        await tx.paymentRefund.deleteMany({ where: { userId } });
        await tx.paymentCharge.deleteMany({ where: { userId } });
      });
    }
  });

  it('rotates past the oldest hundred repeatedly rejected refunds', async () => {
    const suffix = randomUUID();
    const userId = `refund-rotation-${suffix}`;
    const oldUpdatedAt = new Date(Date.now() - 60_000);
    const provider = new RazorpayProvider({ get: () => undefined } as unknown as ConfigService);
    const refundPayment = vi
      .spyOn(provider, 'refundPayment')
      .mockRejectedValue(new Error('temporary provider failure'));
    vi.spyOn(provider, 'fetchRefundsForPayment').mockResolvedValue([]);
    const service = new PaymentsService(
      database!.mongo,
      database!.postgresProvider,
      provider,
      {} as never
    );

    await database!.postgresProvider.withTenantContext(userId, (tx) =>
      tx.paymentRefund.createMany({
        data: Array.from({ length: 101 }, (_, index) => ({
          chargeId: `charge_${suffix}_${index}`,
          userId,
          initiatedByUserId: 'admin_test',
          razorpayPaymentId: `pay_${suffix.replaceAll('-', '')}_${index}`,
          amountMinor: 49900,
          currency: 'INR',
          status: 'requested',
          createdAt: oldUpdatedAt,
          updatedAt: oldUpdatedAt,
        })),
      })
    );

    try {
      const firstBatch = await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentRefund.findMany({
          where: { userId, status: 'requested' },
          orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
          take: 100,
          select: { razorpayPaymentId: true },
        })
      );
      const nextRefund = await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentRefund.findFirst({
          where: {
            userId,
            razorpayPaymentId: {
              notIn: firstBatch.map(({ razorpayPaymentId }) => razorpayPaymentId),
            },
          },
          select: { razorpayPaymentId: true },
        })
      );
      expect(nextRefund).not.toBeNull();

      await service.reconcilePendingRefunds();
      expect(refundPayment).toHaveBeenCalledTimes(100);
      await service.reconcilePendingRefunds();

      expect(refundPayment).toHaveBeenCalledTimes(200);
      expect(refundPayment.mock.calls[100]?.[0]).toBe(nextRefund!.razorpayPaymentId);
      const remaining = await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentRefund.findMany({ where: { userId, status: 'requested' } })
      );
      expect(remaining).toHaveLength(101);
    } finally {
      await database!.postgresProvider.withTenantContext(userId, (tx) =>
        tx.paymentRefund.deleteMany({ where: { userId } })
      );
    }
  });
});
