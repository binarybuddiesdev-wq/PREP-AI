import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@/generated/postgresql-client/index.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { PrismaPostgresqlService, PrismaService } from '@/prisma/prisma.service.js';
import type { CreateSubscriptionInput } from './dto/create-subscription.schema.js';
import { isValidPaymentIdempotencyKey } from './dto/create-subscription.schema.js';
import type { IRazorpaySubscription } from './razorpay-provider.js';
import { RazorpayProvider } from './razorpay-provider.js';
import { parseRazorpaySubscriptionEvent } from './razorpay-webhook-event.js';
import { verifyRazorpayWebhookSignature } from './razorpay-webhook-signature.js';
import { decideSubscriptionRequest } from './subscription-request.js';
import { hasPaidAccess, normalizeProviderStatus } from './payment-state.js';
import { getPaymentChargeRetentionCutoff } from './payment-retention.js';

const IN_PROGRESS_STATUSES = [
  'creating',
  'created',
  'authenticated',
  'active',
  'pending',
  'halted',
  'paused',
];
const TERMINAL_STATUSES = ['cancelled', 'completed', 'expired'];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly mongo: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly provider: RazorpayProvider,
    private readonly jobs: JobQueueService
  ) {}

  async startSubscription(userId: string, input: CreateSubscriptionInput, idempotencyKey?: string) {
    if (!isValidPaymentIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException('A valid Idempotency-Key header is required');
    }
    if (!this.provider.isCheckoutConfigured) {
      throw new ServiceUnavailableException(
        'Razorpay subscriptions are not configured on this server'
      );
    }

    const planId = this.provider.getPlanId(input.plan);
    const local = await this.postgres.withTenantContext(userId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      const existing = await tx.paymentSubscription.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      const decision = decideSubscriptionRequest(existing, idempotencyKey, input.plan);
      if (decision === 'reuse' && existing) return { row: existing, created: false };
      if (decision === 'conflict')
        throw new ConflictException('Idempotency-Key was already used for another plan');

      const active = await tx.paymentSubscription.findFirst({
        where: { userId, status: { in: IN_PROGRESS_STATUSES } },
      });
      if (active)
        throw new ConflictException('An existing subscription is already being processed');

      const row = await tx.paymentSubscription.create({
        data: {
          userId,
          idempotencyKey,
          planKey: input.plan,
          razorpayPlanId: planId,
          status: 'creating',
        },
      });
      return { row, created: true };
    });

    if (!local.created) return this.toSubscriptionResponse(local.row);

    try {
      const remote = await this.provider.createSubscription(userId, input.plan, idempotencyKey);
      const saved = await this.postgres.withTenantContext(userId, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
        const current = await tx.paymentSubscription.findUnique({ where: { id: local.row.id } });
        if (!current) throw new NotFoundException('Payment subscription was not found');
        return tx.paymentSubscription.update({
          where: { id: local.row.id },
          data:
            current.status === 'creating' && !current.razorpaySubscriptionId
              ? {
                  razorpaySubscriptionId: remote.id,
                  shortUrl: remote.short_url ?? null,
                  status: normalizeProviderStatus(remote.status),
                  currentStart: epochDate(remote.current_start),
                  currentEnd: epochDate(remote.current_end),
                }
              : {
                  ...(current.razorpaySubscriptionId ? {} : { razorpaySubscriptionId: remote.id }),
                  ...(current.shortUrl ? {} : { shortUrl: remote.short_url ?? null }),
                },
        });
      });
      return this.toSubscriptionResponse(saved);
    } catch (error) {
      this.logger.error(
        { userId, idempotencyKey, err: error },
        'Razorpay subscription creation did not complete'
      );
      throw new ServiceUnavailableException(
        'Subscription setup is pending provider confirmation. Retry with the same Idempotency-Key.',
        { cause: error }
      );
    }
  }

  async getCurrentSubscription(userId: string) {
    const row = await this.postgres.withTenantContext(userId, (tx) =>
      tx.paymentSubscription.findFirst({
        where: { userId, status: { notIn: TERMINAL_STATUSES } },
        orderBy: { createdAt: 'desc' },
      })
    );
    return row ? this.toSubscriptionResponse(row) : null;
  }

  async acceptWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    eventId: string | undefined
  ) {
    if (!this.provider.isWebhookConfigured) {
      throw new ServiceUnavailableException(
        'Razorpay webhook processing is not configured on this server'
      );
    }
    if (!eventId || eventId.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(eventId)) {
      throw new BadRequestException('A valid x-razorpay-event-id header is required');
    }
    if (!verifyRazorpayWebhookSignature(rawBody, signature, this.provider.webhookSecret)) {
      throw new BadRequestException('Invalid Razorpay webhook signature');
    }

    let event;
    try {
      event = parseRazorpaySubscriptionEvent(JSON.parse(rawBody!.toString('utf8')) as unknown);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid Razorpay webhook payload');
    }

    const expectedPlanId = event.planId;
    let eventRow;
    try {
      eventRow = await this.postgres.withTenantContext(event.userId, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${event.userId}, 0))`;
        const subscription = await tx.paymentSubscription.findUnique({
          where: {
            userId_idempotencyKey: { userId: event.userId, idempotencyKey: event.idempotencyKey },
          },
        });
        if (!subscription || subscription.razorpayPlanId !== expectedPlanId) {
          throw new BadRequestException(
            'Razorpay event does not match a known subscription request'
          );
        }
        if (
          subscription.razorpaySubscriptionId &&
          subscription.razorpaySubscriptionId !== event.subscriptionId
        ) {
          throw new BadRequestException('Razorpay event subscription ID does not match');
        }
        if (!subscription.razorpaySubscriptionId) {
          await tx.paymentSubscription.update({
            where: { id: subscription.id },
            data: { razorpaySubscriptionId: event.subscriptionId },
          });
        }
        if (event.charge) {
          const charge = await tx.paymentCharge.upsert({
            where: { razorpayPaymentId: event.charge.paymentId },
            create: {
              userId: event.userId,
              subscriptionId: subscription.id,
              razorpaySubscriptionId: event.subscriptionId,
              razorpayPaymentId: event.charge.paymentId,
              invoiceId: event.charge.invoiceId,
              amountMinor: event.charge.amountMinor,
              currency: event.charge.currency,
              chargedAt: event.charge.chargedAt,
            },
            update: {},
          });
          if (
            charge.userId !== event.userId ||
            charge.subscriptionId !== subscription.id ||
            charge.razorpaySubscriptionId !== event.subscriptionId ||
            charge.amountMinor !== event.charge.amountMinor ||
            charge.currency !== event.charge.currency ||
            charge.chargedAt.getTime() !== event.charge.chargedAt.getTime() ||
            charge.invoiceId !== event.charge.invoiceId
          ) {
            throw new BadRequestException(
              'Razorpay payment ID was already used for a different charge'
            );
          }
        }
        const prior = await tx.paymentWebhookEvent.findUnique({ where: { eventId } });
        if (prior) {
          if (prior.userId !== event.userId || prior.subscriptionId !== event.subscriptionId) {
            throw new BadRequestException(
              'Razorpay event ID was already used for a different event'
            );
          }
          return prior;
        }
        return tx.paymentWebhookEvent.create({
          data: {
            userId: event.userId,
            eventId,
            eventType: event.eventType,
            subscriptionId: event.subscriptionId,
            idempotencyKey: event.idempotencyKey,
            occurredAt: event.eventAt,
          },
        });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      eventRow = await this.postgres.withTenantContext(event.userId, (tx) =>
        tx.paymentWebhookEvent.findUnique({ where: { eventId } })
      );
      if (
        !eventRow ||
        eventRow.userId !== event.userId ||
        eventRow.subscriptionId !== event.subscriptionId
      ) {
        throw new BadRequestException('Razorpay event ID was already used for a different event');
      }
    }

    try {
      await this.jobs.enqueue(
        JOB_QUEUE_NAMES.PAYMENT_RECONCILIATION,
        {
          idempotencyKey: eventId,
          userId: eventRow.userId,
        },
        'reconcile-subscription',
        true
      );
      await this.postgres.withTenantContext(eventRow.userId, (tx) =>
        tx.paymentWebhookEvent.update({
          where: { id: eventRow.id },
          data: { dispatchClaimedAt: new Date(), attempts: { increment: 1 }, failureCode: null },
        })
      );
    } catch (error) {
      this.logger.error(
        { eventId, err: error },
        'Razorpay event persisted but queue dispatch failed'
      );
      throw new ServiceUnavailableException('Razorpay event was saved and will be retried', {
        cause: error,
      });
    }
    return { received: true };
  }

  async processWebhookEvent(userId: string, eventId: string): Promise<void> {
    const event = await this.postgres.withTenantContext(userId, (tx) =>
      tx.paymentWebhookEvent.findFirst({ where: { userId, eventId } })
    );
    if (!event || event.processedAt) return;

    const local = await this.postgres.withTenantContext(userId, (tx) =>
      tx.paymentSubscription.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: event.idempotencyKey } },
      })
    );
    if (!local?.razorpaySubscriptionId || local.razorpaySubscriptionId !== event.subscriptionId) {
      throw new Error('Payment webhook does not match a persisted provider subscription');
    }

    await this.fetchAndApplyProviderState(userId, local.id);

    await this.postgres.withTenantContext(userId, (tx) =>
      tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'processed', processedAt: new Date(), failureCode: null },
      })
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePendingPayments(): Promise<void> {
    const client = this.postgres.client_;
    if (!client) return;
    const pending = await client.paymentWebhookEvent.findMany({
      where: {
        status: 'received',
        OR: [
          { dispatchClaimedAt: null },
          { dispatchClaimedAt: { lt: new Date(Date.now() - 60_000) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { userId: true, eventId: true, id: true },
    });
    for (const event of pending) {
      try {
        await this.jobs.enqueue(
          JOB_QUEUE_NAMES.PAYMENT_RECONCILIATION,
          {
            idempotencyKey: event.eventId,
            userId: event.userId,
          },
          'reconcile-subscription',
          true
        );
        await this.postgres.withTenantContext(event.userId, (tx) =>
          tx.paymentWebhookEvent.update({
            where: { id: event.id },
            data: { dispatchClaimedAt: new Date(), attempts: { increment: 1 }, failureCode: null },
          })
        );
      } catch (error) {
        this.logger.warn(
          { eventId: event.eventId, err: error },
          'Payment event reconciliation dispatch failed'
        );
      }
    }

    const expired = await client.paymentSubscription.findMany({
      where: { status: 'active', currentEnd: { lte: new Date() } },
      take: 100,
      select: {
        id: true,
        userId: true,
        idempotencyKey: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
      },
    });
    for (const subscription of expired) {
      if (!subscription.razorpaySubscriptionId) continue;
      try {
        await this.fetchAndApplyProviderState(subscription.userId, subscription.id);
      } catch (error) {
        try {
          await this.projectUserEntitlement(subscription.userId);
        } catch (projectionError) {
          this.logger.error(
            { subscriptionId: subscription.id, err: projectionError },
            'Expired payment entitlement fallback failed'
          );
        }
        this.logger.warn(
          { subscriptionId: subscription.id, err: error },
          'Expired payment reconciliation failed'
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredPaymentCharges(): Promise<void> {
    const client = this.postgres.client_;
    if (!client) return;
    try {
      const result = await client.paymentCharge.deleteMany({
        where: { createdAt: { lt: getPaymentChargeRetentionCutoff(new Date()) } },
      });
      this.logger.log({ deletedCount: result.count }, 'Expired payment charge records removed');
    } catch (error) {
      this.logger.warn({ err: error }, 'Expired payment charge cleanup failed');
    }
  }

  private async fetchAndApplyProviderState(userId: string, localId: string): Promise<void> {
    await this.postgres.withTenantContext(
      userId,
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
        const subscription = await tx.paymentSubscription.findUnique({ where: { id: localId } });
        if (!subscription) throw new NotFoundException('Payment subscription was not found');
        if (!subscription.razorpaySubscriptionId)
          throw new Error('Payment subscription has no provider subscription ID');
        const remote = await this.provider.fetchSubscription(subscription.razorpaySubscriptionId);
        this.assertProviderSubscriptionIdentity(remote, subscription, userId);
        await tx.paymentSubscription.update({
          where: { id: localId },
          data: {
            status: normalizeProviderStatus(remote.status),
            currentStart: epochDate(remote.current_start),
            currentEnd: epochDate(remote.current_end),
          },
        });
        await this.projectUserEntitlementInTransaction(userId, tx);
      },
      { maxWait: 10_000, timeout: 45_000 }
    );
  }

  private async projectUserEntitlement(userId: string): Promise<void> {
    await this.postgres.withTenantContext(userId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      await this.projectUserEntitlementInTransaction(userId, tx);
    });
  }

  private async projectUserEntitlementInTransaction(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const subscriptions = await tx.paymentSubscription.findMany({
      where: { userId },
      select: { status: true, currentStart: true, currentEnd: true },
    });
    const paid = subscriptions.some((subscription) =>
      hasPaidAccess(subscription.status, subscription.currentStart, subscription.currentEnd)
    );
    const latestPeriodEnd = subscriptions
      .map(({ currentEnd }) => currentEnd?.toISOString() ?? '')
      .sort()
      .at(-1);

    const user = await this.mongo.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    if (!user) throw new Error('Subscription owner profile is not available for role projection');
    const nextRole = paid
      ? user.role === 'ADMIN'
        ? 'ADMIN'
        : 'PREMIUM'
      : user.role === 'PREMIUM'
        ? 'USER'
        : user.role;
    if (nextRole === user.role) return;

    try {
      await this.mongo.inAppNotification.create({
        data: {
          userId,
          idempotencyKey: `subscription-role:${userId}:${nextRole}:${latestPeriodEnd ?? 'unknown'}`,
          category: 'billing',
          title: nextRole === 'PREMIUM' ? 'Premium is active' : 'Premium access ended',
          body:
            nextRole === 'PREMIUM'
              ? 'Your subscription is active. Premium features are now available.'
              : 'Your paid subscription period has ended.',
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
    await this.mongo.user.update({ where: { clerkUserId: userId }, data: { role: nextRole } });
  }

  private assertProviderSubscriptionIdentity(
    remote: IRazorpaySubscription,
    local: {
      razorpaySubscriptionId?: string | null;
      razorpayPlanId?: string;
      idempotencyKey?: string;
    },
    userId: string
  ): void {
    if (
      (local.razorpaySubscriptionId && remote.id !== local.razorpaySubscriptionId) ||
      (local.razorpayPlanId && remote.plan_id !== local.razorpayPlanId) ||
      remote.notes?.['prepai_user_id'] !== userId ||
      (local.idempotencyKey && remote.notes?.['prepai_request_id'] !== local.idempotencyKey)
    ) {
      throw new Error('Razorpay subscription identity did not match the local record');
    }
  }

  private toSubscriptionResponse(row: {
    id: string;
    planKey: string;
    status: string;
    shortUrl: string | null;
    currentStart: Date | null;
    currentEnd: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      plan: row.planKey,
      status: row.status,
      checkoutUrl: row.shortUrl,
      currentPeriodStart: row.currentStart,
      currentPeriodEnd: row.currentEnd,
      createdAt: row.createdAt,
    };
  }
}

function epochDate(value: number | null | undefined): Date | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value * 1000)
    : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
