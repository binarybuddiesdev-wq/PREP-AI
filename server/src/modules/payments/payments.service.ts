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
import type { IRazorpayRefund, IRazorpaySubscription } from './razorpay-provider.js';
import { RazorpayApiError, RazorpayProvider } from './razorpay-provider.js';
import { parseRazorpaySubscriptionEvent } from './razorpay-webhook-event.js';
import { verifyRazorpayWebhookSignature } from './razorpay-webhook-signature.js';
import { decideSubscriptionRequest } from './subscription-request.js';
import { hasPaidAccess, normalizeProviderStatus } from './payment-state.js';
import { getPaymentChargeRetentionCutoff } from './payment-retention.js';
import { appendAuditLog, makeSignatureFailureEventKey } from '@/modules/audit/audit-log.service.js';

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
        where: {
          userId,
          OR: [
            { status: { in: IN_PROGRESS_STATUSES } },
            { cancelAtPeriodEnd: true, currentEnd: { gt: new Date() } },
          ],
        },
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
        where: {
          userId,
          OR: [
            { status: { notIn: TERMINAL_STATUSES } },
            { cancelAtPeriodEnd: true, currentEnd: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      })
    );
    return row ? this.toSubscriptionResponse(row) : null;
  }

  async cancelCurrentSubscription(userId: string) {
    if (!this.provider.isCheckoutConfigured) {
      throw new ServiceUnavailableException(
        'Razorpay subscriptions are not configured on this server'
      );
    }

    let result;
    try {
      result = await this.postgres.withTenantContext(
        userId,
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
          const subscription = await tx.paymentSubscription.findFirst({
            where: {
              userId,
              OR: [
                { status: { notIn: TERMINAL_STATUSES } },
                { cancelAtPeriodEnd: true, currentEnd: { gt: new Date() } },
              ],
            },
            orderBy: { createdAt: 'desc' },
          });
          if (!subscription) throw new NotFoundException('No current subscription was found');
          if (subscription.cancelAtPeriodEnd) return this.toSubscriptionResponse(subscription);
          if (
            subscription.status !== 'active' ||
            !subscription.razorpaySubscriptionId ||
            !hasPaidAccess(subscription.status, subscription.currentStart, subscription.currentEnd)
          ) {
            throw new ConflictException('Only an active paid subscription can be cancelled');
          }

          let remote: IRazorpaySubscription;
          try {
            remote = await this.provider.cancelSubscription(subscription.razorpaySubscriptionId);
          } catch (cancelError) {
            // The provider may complete cancellation but lose the response. A fetch
            // confirms that ambiguous result without issuing another mutation.
            remote = await this.provider.fetchSubscription(subscription.razorpaySubscriptionId);
            this.assertProviderSubscriptionIdentity(remote, subscription, userId);
            const confirmedEnd = epochDate(remote.current_end) ?? subscription.currentEnd;
            const cancellationConfirmed =
              normalizeProviderStatus(remote.status) === 'cancelled' &&
              confirmedEnd !== null &&
              confirmedEnd > new Date();
            if (!cancellationConfirmed) {
              throw cancelError;
            }
          }
          this.assertProviderSubscriptionIdentity(remote, subscription, userId);
          const remoteStatus = normalizeProviderStatus(remote.status);
          if (remoteStatus !== 'active' && remoteStatus !== 'cancelled') {
            throw new Error('Razorpay returned an unexpected status after cancellation');
          }
          const saved = await tx.paymentSubscription.update({
            where: { id: subscription.id },
            data: {
              status: remoteStatus,
              currentStart: epochDate(remote.current_start) ?? subscription.currentStart,
              currentEnd: epochDate(remote.current_end) ?? subscription.currentEnd,
              cancelAtPeriodEnd: true,
            },
          });
          await appendAuditLog(tx as never, {
            actorType: 'USER',
            actorId: userId,
            subjectUserId: userId,
            action: 'payment.subscription_cancelled',
            resourceType: 'payment_subscription',
            resourceId: subscription.id,
            eventKey: `subscription-cancelled:${subscription.id}`,
          });
          return this.toSubscriptionResponse(saved);
        },
        { maxWait: 10_000, timeout: 45_000 }
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(
        { userId, err: error },
        'Razorpay subscription cancellation did not complete'
      );
      throw new ServiceUnavailableException(
        'Subscription cancellation could not be confirmed. Retry the request.',
        { cause: error }
      );
    }

    try {
      await this.projectUserEntitlement(userId);
    } catch (error) {
      this.logger.error(
        { userId, err: error },
        'Subscription cancellation entitlement projection failed'
      );
      throw new ServiceUnavailableException(
        'Cancellation was saved, but Premium status could not be refreshed. Retry the request.',
        { cause: error }
      );
    }
    return result;
  }

  async initiateFullRefund(chargeId: string, adminUserId: string) {
    const client = this.postgres.client_;
    if (!client) throw new ServiceUnavailableException('Payment storage is not available');
    const charge = await client.paymentCharge.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('Captured payment charge was not found');

    const intent = await this.postgres.withTenantContext(charge.userId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${charge.userId}, 0))`;
      const ownedCharge = await tx.paymentCharge.findFirst({
        where: { id: charge.id, userId: charge.userId },
      });
      if (!ownedCharge) throw new NotFoundException('Captured payment charge was not found');
      const existing = await tx.paymentRefund.findUnique({ where: { chargeId: ownedCharge.id } });
      if (existing) return existing;
      const refund = await tx.paymentRefund.create({
        data: {
          chargeId: ownedCharge.id,
          userId: ownedCharge.userId,
          initiatedByUserId: adminUserId,
          razorpayPaymentId: ownedCharge.razorpayPaymentId,
          amountMinor: ownedCharge.amountMinor,
          currency: ownedCharge.currency,
          status: 'requested',
        },
      });
      await appendAuditLog(tx as never, {
        actorType: 'ADMIN',
        actorId: adminUserId,
        subjectUserId: ownedCharge.userId,
        action: 'payment.refund_requested',
        resourceType: 'payment_refund',
        resourceId: refund.id,
        eventKey: `payment-refund-requested:${refund.id}`,
        details: {
          chargeId: ownedCharge.id,
          amountMinor: refund.amountMinor,
          currency: refund.currency,
        },
      });
      return refund;
    });

    if (intent.status !== 'requested' || intent.razorpayRefundId) {
      return this.toRefundResponse(intent);
    }

    let remote: IRazorpayRefund | null;
    try {
      remote = await this.requestFullRefund(intent);
    } catch (error) {
      this.logger.warn(
        { refundId: intent.id, err: redactRefundError(error) },
        'Razorpay refund request did not return a result'
      );
      throw new ServiceUnavailableException(
        'Refund request is saved and will be retried with the same provider idempotency key',
        { cause: error }
      );
    }
    if (!remote) {
      throw new ServiceUnavailableException(
        'Refund request is saved and will be retried when Razorpay can accept it'
      );
    }

    this.assertRefundMatchesIntent(remote, intent);
    const saved = await this.updateRefundState(intent.userId, intent.id, {
      razorpayRefundId: remote.id,
      status: remote.status,
      failureCode: null,
      providerCreatedAt: epochDate(remote.created_at),
    });
    return this.toRefundResponse(saved);
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
      try {
        await appendAuditLog(this.postgres.client_ as never, {
          actorType: 'ANONYMOUS',
          action: 'webhook.signature_failed',
          resourceType: 'webhook',
          resourceId: 'razorpay',
          eventKey: makeSignatureFailureEventKey('RAZORPAY', 'webhooks/razorpay'),
          details: { provider: 'RAZORPAY', route: 'webhooks/razorpay' },
        });
      } catch (error) {
        this.logger.warn(
          { err: redactRefundError(error) },
          'Could not audit Razorpay signature failure'
        );
      }
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
        const createdEvent = await tx.paymentWebhookEvent.create({
          data: {
            userId: event.userId,
            eventId,
            eventType: event.eventType,
            subscriptionId: event.subscriptionId,
            idempotencyKey: event.idempotencyKey,
            occurredAt: event.eventAt,
          },
        });
        await appendAuditLog(tx as never, {
          actorType: 'PROVIDER',
          subjectUserId: event.userId,
          action: 'payment.webhook_received',
          resourceType: 'payment_webhook_event',
          resourceId: createdEvent.id,
          eventKey: `payment-webhook:${eventId}`,
          details: { eventType: event.eventType },
        });
        return createdEvent;
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

    const expiredAt = new Date();
    const expired = await client.paymentSubscription.findMany({
      where: {
        OR: [
          { status: 'active', currentEnd: { lte: expiredAt } },
          {
            status: 'cancelled',
            cancelAtPeriodEnd: true,
            currentEnd: { lte: expiredAt },
          },
        ],
      },
      take: 100,
      select: {
        id: true,
        userId: true,
        idempotencyKey: true,
        razorpaySubscriptionId: true,
        razorpayPlanId: true,
        cancelAtPeriodEnd: true,
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
      const expiredRefunds = await client.paymentRefund.deleteMany({
        where: { createdAt: { lt: getPaymentChargeRetentionCutoff(new Date()) } },
      });
      const result = await client.paymentCharge.deleteMany({
        where: { createdAt: { lt: getPaymentChargeRetentionCutoff(new Date()) } },
      });
      this.logger.log(
        { deletedCharges: result.count, deletedRefunds: expiredRefunds.count },
        'Expired payment charge and refund records removed'
      );
    } catch (error) {
      this.logger.warn({ err: error }, 'Expired payment charge cleanup failed');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async reconcilePendingRefunds(): Promise<void> {
    const client = this.postgres.client_;
    if (!client) return;
    const pending = await client.paymentRefund.findMany({
      where: { status: { in: ['requested', 'pending'] } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        userId: true,
        razorpayPaymentId: true,
        razorpayRefundId: true,
        amountMinor: true,
        currency: true,
      },
    });
    for (const intent of pending) {
      try {
        const remote = intent.razorpayRefundId
          ? await this.provider.fetchRefund(intent.razorpayRefundId)
          : await this.requestFullRefund(intent);
        if (!remote) continue;
        this.assertRefundMatchesIntent(remote, intent);
        await this.updateRefundState(intent.userId, intent.id, {
          razorpayRefundId: remote.id,
          status: remote.status,
          failureCode: null,
          providerCreatedAt: epochDate(remote.created_at),
        });
      } catch (error) {
        try {
          await this.updateRefundState(intent.userId, intent.id, {
            status: intent.razorpayRefundId ? 'pending' : 'requested',
            failureCode: 'RECONCILIATION_RETRY',
          });
        } catch (stateError) {
          this.logger.warn(
            { refundId: intent.id, err: redactRefundError(stateError) },
            'Could not reschedule pending Razorpay refund reconciliation'
          );
        }
        this.logger.warn(
          { refundId: intent.id, err: redactRefundError(error) },
          'Pending Razorpay refund reconciliation failed'
        );
      }
    }
  }

  private async updateRefundState(
    userId: string,
    refundId: string,
    data: {
      razorpayRefundId?: string;
      status: string;
      failureCode?: string | null;
      providerCreatedAt?: Date | null;
    }
  ) {
    return this.postgres.withTenantContext(userId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      const saved = await tx.paymentRefund.update({
        where: { id: refundId },
        data: { ...data, updatedAt: new Date() },
      });
      await appendAuditLog(tx as never, {
        actorType: 'PROVIDER',
        actorId: 'razorpay',
        subjectUserId: userId,
        action: 'payment.refund_state_changed',
        resourceType: 'payment_refund',
        resourceId: refundId,
        eventKey: `payment-refund-state:${refundId}:${data.status}:${data.razorpayRefundId ?? 'unlinked'}`,
        details: {
          status: data.status,
          ...(data.razorpayRefundId ? { providerRefundId: data.razorpayRefundId } : {}),
        },
      });
      return saved;
    });
  }

  private async requestFullRefund(intent: {
    id: string;
    userId: string;
    razorpayPaymentId: string;
    amountMinor: number;
    currency: string;
  }): Promise<IRazorpayRefund | null> {
    try {
      return await this.provider.refundPayment(intent.razorpayPaymentId, intent.id);
    } catch (error) {
      if (!(error instanceof RazorpayApiError) || error.statusCode !== 400) throw error;

      let existingRefunds: IRazorpayRefund[];
      try {
        existingRefunds = await this.provider.fetchRefundsForPayment(intent.razorpayPaymentId);
      } catch (fetchError) {
        throw new ServiceUnavailableException('Razorpay refund state could not be checked', {
          cause: fetchError,
        });
      }
      const priorFullRefund = existingRefunds.find(
        (refund) =>
          refund.payment_id === intent.razorpayPaymentId &&
          refund.amount === intent.amountMinor &&
          refund.currency === intent.currency
      );
      if (priorFullRefund) return priorFullRefund;

      // Razorpay can reject a refund temporarily (for example, while funds are
      // unavailable). Keep the same intent/key and let the worker retry fairly.
      await this.updateRefundState(intent.userId, intent.id, {
        status: 'requested',
        failureCode: 'PROVIDER_RETRYABLE',
      });
      return null;
    }
  }

  private assertRefundMatchesIntent(
    remote: IRazorpayRefund,
    local: {
      razorpayPaymentId: string;
      amountMinor: number;
      currency: string;
    }
  ): void {
    if (
      !remote.id ||
      remote.payment_id !== local.razorpayPaymentId ||
      remote.amount !== local.amountMinor ||
      remote.currency !== local.currency ||
      !['pending', 'processed', 'failed'].includes(remote.status)
    ) {
      throw new ServiceUnavailableException(
        'Razorpay returned a refund that does not match the saved charge'
      );
    }
  }

  private toRefundResponse(row: {
    id: string;
    chargeId: string;
    amountMinor: number;
    currency: string;
    razorpayRefundId: string | null;
    status: string;
    createdAt: Date;
    providerCreatedAt: Date | null;
  }) {
    return {
      id: row.id,
      chargeId: row.chargeId,
      amountMinor: row.amountMinor,
      currency: row.currency,
      razorpayRefundId: row.razorpayRefundId,
      status: row.status,
      requestedAt: row.createdAt,
      providerCreatedAt: row.providerCreatedAt,
    };
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
            currentStart: epochDate(remote.current_start) ?? subscription.currentStart,
            currentEnd: epochDate(remote.current_end) ?? subscription.currentEnd,
            cancelAtPeriodEnd:
              subscription.cancelAtPeriodEnd &&
              (epochDate(remote.current_end) ?? subscription.currentEnd ?? new Date(0)) >
                new Date(),
          },
        });
      },
      { maxWait: 10_000, timeout: 45_000 }
    );
    await this.projectUserEntitlement(userId);
  }

  private async projectUserEntitlement(userId: string): Promise<void> {
    await this.postgres.withTenantContext(userId, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
      const projection = await this.projectUserEntitlementInTransaction(userId, tx);
      await this.applyUserEntitlementProjection(userId, projection);
    });
  }

  private async projectUserEntitlementInTransaction(
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<{ paid: boolean; latestPeriodEnd: string | undefined }> {
    const subscriptions = await tx.paymentSubscription.findMany({
      where: { userId },
      select: { status: true, currentStart: true, currentEnd: true, cancelAtPeriodEnd: true },
    });
    const paid = subscriptions.some((subscription) =>
      hasPaidAccess(
        subscription.status,
        subscription.currentStart,
        subscription.currentEnd,
        new Date(),
        subscription.cancelAtPeriodEnd
      )
    );
    const latestPeriodEnd = subscriptions
      .map(({ currentEnd }) => currentEnd?.toISOString() ?? '')
      .sort()
      .at(-1);

    return { paid, latestPeriodEnd };
  }

  private async applyUserEntitlementProjection(
    userId: string,
    projection: { paid: boolean; latestPeriodEnd: string | undefined }
  ): Promise<void> {
    const user = await this.mongo.user.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    if (!user) throw new Error('Subscription owner profile is not available for role projection');
    const nextRole = projection.paid
      ? user.role === 'ADMIN'
        ? 'ADMIN'
        : 'PREMIUM'
      : user.role === 'PREMIUM'
        ? 'USER'
        : user.role;
    if (nextRole === user.role) return;

    await appendAuditLog(this.postgres.workerClient_ as never, {
      actorType: 'SYSTEM',
      actorId: 'payment_entitlement_projection',
      subjectUserId: userId,
      action: 'user.role_projection_requested',
      resourceType: 'user',
      resourceId: userId,
      eventKey: `user-role:${userId}:${nextRole}:${projection.latestPeriodEnd ?? 'unknown'}`,
      details: { fromRole: user.role, toRole: nextRole },
    });

    try {
      await this.mongo.inAppNotification.create({
        data: {
          userId,
          idempotencyKey: `subscription-role:${userId}:${nextRole}:${projection.latestPeriodEnd ?? 'unknown'}`,
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
    cancelAtPeriodEnd: boolean;
  }) {
    return {
      id: row.id,
      plan: row.planKey,
      status: row.status,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
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

function redactRefundError(error: unknown): Record<string, unknown> {
  if (error instanceof RazorpayApiError) {
    return { name: error.name, statusCode: error.statusCode, code: error.code };
  }
  if (error instanceof Error) return { name: error.name };
  return { name: 'UnknownError' };
}
