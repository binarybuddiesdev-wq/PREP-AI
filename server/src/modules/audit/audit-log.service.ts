import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Prisma } from '@/generated/postgresql-client/index.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';

export type TAuditActorType = 'ADMIN' | 'USER' | 'SYSTEM' | 'PROVIDER' | 'ANONYMOUS';
export type TAuditAction =
  | 'payment.subscription_cancelled'
  | 'payment.refund_requested'
  | 'payment.refund_state_changed'
  | 'payment.webhook_received'
  | 'user.role_projection_requested'
  | 'user.account_deleted'
  | 'webhook.signature_failed';
export type TAuditResourceType =
  'payment_subscription' | 'payment_refund' | 'payment_webhook_event' | 'user' | 'webhook';

export interface IAuditLogInput {
  actorType: TAuditActorType;
  actorId?: string | null;
  subjectUserId?: string | null;
  action: TAuditAction;
  resourceType: TAuditResourceType;
  resourceId?: string | null;
  eventKey?: string | null;
  details?: Prisma.InputJsonObject;
}

type TAuditLogClient = {
  $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

export async function appendAuditLog(
  client: TAuditLogClient | undefined,
  input: IAuditLogInput
): Promise<void> {
  if (!client) throw new ServiceUnavailableException('Audit storage is not available');
  validateAuditInput(input);
  const detailsJson = input.details === undefined ? null : JSON.stringify(input.details);
  try {
    await client.$executeRaw`
      SELECT public.prepai_append_audit_log(
        ${randomUUID()}, ${input.actorType}, ${input.actorId ?? null},
        ${input.subjectUserId ?? null}, ${input.action}, ${input.resourceType},
        ${input.resourceId ?? null}, ${input.eventKey ?? null}, ${detailsJson}::jsonb
      )
    `;
  } catch (error) {
    throw new ServiceUnavailableException('Audit event could not be stored', { cause: error });
  }
}

export function makeSignatureFailureEventKey(
  provider: 'CLERK' | 'RAZORPAY',
  route: string,
  now = Date.now()
): string {
  return `webhook-signature:${provider.toLowerCase()}:${route}:${Math.floor(now / 60_000)}`;
}

function validateAuditInput(input: IAuditLogInput): void {
  const allowedResources: Record<TAuditAction, TAuditResourceType> = {
    'payment.subscription_cancelled': 'payment_subscription',
    'payment.refund_requested': 'payment_refund',
    'payment.refund_state_changed': 'payment_refund',
    'payment.webhook_received': 'payment_webhook_event',
    'user.role_projection_requested': 'user',
    'user.account_deleted': 'user',
    'webhook.signature_failed': 'webhook',
  };
  if (allowedResources[input.action] !== input.resourceType) {
    throw new TypeError('Audit action and resource type are not allow-listed');
  }
  if (
    (input.actorId?.length ?? 0) > 128 ||
    (input.subjectUserId?.length ?? 0) > 128 ||
    (input.resourceId?.length ?? 0) > 128 ||
    (input.eventKey?.length ?? 0) > 512
  ) {
    throw new TypeError('Audit event field exceeds the allowed size');
  }
  if (!input.eventKey) throw new TypeError('Audit event key is required');
  if (input.details && Buffer.byteLength(JSON.stringify(input.details), 'utf8') > 2048) {
    throw new TypeError('Audit details exceed the allowed size');
  }
  const keys = Object.keys(input.details ?? {});
  const allowedKeys: Record<TAuditAction, string[]> = {
    'payment.subscription_cancelled': [],
    'payment.refund_requested': ['chargeId', 'amountMinor', 'currency'],
    'payment.refund_state_changed': ['status', 'providerRefundId'],
    'payment.webhook_received': ['eventType'],
    'user.role_projection_requested': ['fromRole', 'toRole'],
    'user.account_deleted': [],
    'webhook.signature_failed': ['provider', 'route'],
  };
  if (keys.some((key) => !allowedKeys[input.action].includes(key))) {
    throw new TypeError('Audit details contain a field that is not allow-listed');
  }
  if (input.action === 'webhook.signature_failed') {
    const details = input.details;
    if (
      !details ||
      !['CLERK', 'RAZORPAY'].includes(String(details.provider)) ||
      !['webhooks/clerk', 'webhooks/razorpay'].includes(String(details.route)) ||
      !input.eventKey?.startsWith(
        `webhook-signature:${String(details.provider).toLowerCase()}:${String(details.route)}:`
      ) ||
      !/\d+$/.test(input.eventKey)
    ) {
      throw new TypeError('Webhook signature failure audit details are invalid');
    }
  }
  if (input.action === 'payment.webhook_received') {
    const eventType = input.details?.['eventType'];
    if (
      ![
        'subscription.authenticated',
        'subscription.activated',
        'subscription.charged',
        'subscription.pending',
        'subscription.halted',
        'subscription.paused',
        'subscription.resumed',
        'subscription.cancelled',
        'subscription.completed',
      ].includes(String(eventType))
    ) {
      throw new TypeError('Payment webhook audit event type is not allow-listed');
    }
  }
  if (input.action === 'user.role_projection_requested') {
    const fromRole = input.details?.['fromRole'];
    const toRole = input.details?.['toRole'];
    const roles = ['USER', 'PREMIUM', 'ADMIN'];
    if (!roles.includes(String(fromRole)) || !roles.includes(String(toRole))) {
      throw new TypeError('Role projection audit details are invalid');
    }
  }
  if (input.action === 'payment.refund_state_changed') {
    const status = input.details?.['status'];
    if (!['requested', 'pending', 'processed', 'failed'].includes(String(status))) {
      throw new TypeError('Refund state audit details are invalid');
    }
  }
  if (input.action === 'payment.refund_requested') {
    const amountMinor = input.details?.['amountMinor'];
    const currency = input.details?.['currency'];
    if (
      typeof amountMinor !== 'number' ||
      amountMinor <= 0 ||
      typeof currency !== 'string' ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      throw new TypeError('Refund request audit details are invalid');
    }
  }
}

@Injectable()
export class AuditLogService {
  constructor(
    private readonly postgres: PrismaPostgresqlService,
    @InjectPinoLogger(AuditLogService.name) private readonly logger: PinoLogger
  ) {}

  async append(input: IAuditLogInput, transaction?: Prisma.TransactionClient): Promise<void> {
    try {
      await appendAuditLog((transaction ?? this.postgres.client_) as TAuditLogClient, input);
    } catch (error) {
      if (error instanceof TypeError) throw error;
      if (
        error instanceof ServiceUnavailableException &&
        error.message === 'Audit storage is not available'
      ) {
        throw error;
      }
      this.logger.error(
        { action: input.action, resourceType: input.resourceType, err: redactError(error) },
        'Audit event could not be stored'
      );
      throw new ServiceUnavailableException('Audit event could not be stored', { cause: error });
    }
  }

  async recordSecurityFailure(provider: 'CLERK' | 'RAZORPAY', route: string): Promise<void> {
    try {
      await this.append({
        actorType: 'ANONYMOUS',
        action: 'webhook.signature_failed',
        resourceType: 'webhook',
        resourceId: provider.toLowerCase(),
        eventKey: makeSignatureFailureEventKey(provider, route),
        details: { provider, route },
      });
    } catch (error) {
      this.logger.warn(
        { provider, route, err: redactError(error) },
        'Webhook signature failure could not be added to the audit log'
      );
    }
  }
}

function redactError(error: unknown): { name: string } {
  return { name: error instanceof Error ? error.name : 'UnknownError' };
}
