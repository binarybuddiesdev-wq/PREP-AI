import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuditLogService,
  makeSignatureFailureEventKey,
  type IAuditLogInput,
} from './audit-log.service.js';

describe('AuditLogService', () => {
  const event = {
    actorType: 'ADMIN' as const,
    actorId: 'admin_1',
    subjectUserId: 'user_1',
    action: 'payment.refund_requested',
    resourceType: 'payment_refund',
    resourceId: 'refund_1',
    eventKey: 'refund:refund_1:requested',
    details: { amountMinor: 49900, currency: 'INR' },
  } as const;
  let client: { $executeRaw: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let service: AuditLogService;

  beforeEach(() => {
    client = { $executeRaw: vi.fn().mockResolvedValue(1) };
    logger = { error: vi.fn(), warn: vi.fn() };
    service = new AuditLogService({ client_: client } as never, logger as never);
  });

  it('appends allow-listed audit fields with a stable event key', async () => {
    await service.append(event);

    expect(client.$executeRaw).toHaveBeenCalledOnce();
    expect(client.$executeRaw.mock.calls[0]?.[0].join(' ')).toContain(
      'public.prepai_append_audit_log('
    );
    expect(client.$executeRaw.mock.calls[0]?.slice(1)).toEqual([
      expect.any(String),
      event.actorType,
      event.actorId,
      event.subjectUserId,
      event.action,
      event.resourceType,
      event.resourceId,
      event.eventKey,
      JSON.stringify(event.details),
    ]);
  });

  it('stores omitted details as SQL NULL', async () => {
    const { details: _details, ...eventWithoutDetails } = event;

    await service.append({
      ...eventWithoutDetails,
      actorType: 'PROVIDER',
      action: 'user.account_deleted',
      resourceType: 'user',
    });

    expect(client.$executeRaw.mock.calls[0]?.slice(1).at(-1)).toBeNull();
  });

  it('treats a duplicate event key as an idempotent replay', async () => {
    client.$executeRaw.mockResolvedValueOnce(0);

    await expect(service.append(event)).resolves.toBeUndefined();
  });

  it('reports database errors without accepting an unrecorded event', async () => {
    client.$executeRaw.mockRejectedValueOnce(new Error('database failure'));

    await expect(service.append(event)).rejects.toThrow(ServiceUnavailableException);
  });

  it('writes through the caller transaction when provided', async () => {
    const transaction = { $executeRaw: vi.fn().mockResolvedValue(1) };

    await service.append(event, transaction as never);

    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects required audit events when PostgreSQL is unavailable', async () => {
    service = new AuditLogService({ client_: undefined } as never, logger as never);

    await expect(service.append(event)).rejects.toThrow(ServiceUnavailableException);
  });

  it('keeps webhook signature rejection best-effort during an audit-store outage', async () => {
    service = new AuditLogService({ client_: undefined } as never, logger as never);

    await expect(service.recordSecurityFailure('CLERK', 'webhooks/clerk')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('records webhook signature failures when the audit store is available', async () => {
    await service.recordSecurityFailure('RAZORPAY', 'webhooks/razorpay');

    expect(client.$executeRaw).toHaveBeenCalledOnce();
    expect(client.$executeRaw.mock.calls[0]?.slice(1)).toEqual([
      expect.any(String),
      'ANONYMOUS',
      null,
      null,
      'webhook.signature_failed',
      'webhook',
      'razorpay',
      expect.stringMatching(/^webhook-signature:razorpay:webhooks\/razorpay:\d+$/),
      JSON.stringify({ provider: 'RAZORPAY', route: 'webhooks/razorpay' }),
    ]);
  });

  it('coalesces public signature failures into provider-route minute buckets', () => {
    const startOfMinute = 60_000 * 30;

    expect(makeSignatureFailureEventKey('CLERK', 'webhooks/clerk', startOfMinute + 1)).toBe(
      makeSignatureFailureEventKey('CLERK', 'webhooks/clerk', startOfMinute + 59_999)
    );
    expect(
      makeSignatureFailureEventKey('CLERK', 'webhooks/clerk', startOfMinute + 60_000)
    ).not.toBe(makeSignatureFailureEventKey('CLERK', 'webhooks/clerk', startOfMinute + 1));
  });

  it('rejects unapproved audit detail fields before reaching PostgreSQL', async () => {
    await expect(
      service.append({
        ...event,
        details: { ...event.details, rawWebhookBody: 'sensitive payload' },
      })
    ).rejects.toThrow('Audit details contain a field that is not allow-listed');

    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it.each([
    {
      actorType: 'USER',
      actorId: 'user_1',
      subjectUserId: 'user_1',
      action: 'payment.subscription_cancelled',
      resourceType: 'payment_subscription',
      resourceId: 'subscription_1',
      eventKey: 'subscription-cancelled:subscription_1',
    },
    {
      actorType: 'PROVIDER',
      actorId: 'razorpay',
      subjectUserId: 'user_1',
      action: 'payment.refund_state_changed',
      resourceType: 'payment_refund',
      resourceId: 'refund_1',
      eventKey: 'payment-refund-state:refund_1:pending:unlinked',
      details: { status: 'pending' },
    },
    {
      actorType: 'PROVIDER',
      subjectUserId: 'user_1',
      action: 'payment.webhook_received',
      resourceType: 'payment_webhook_event',
      resourceId: 'event_1',
      eventKey: 'payment-webhook:event_1',
      details: { eventType: 'subscription.activated' },
    },
    {
      actorType: 'SYSTEM',
      actorId: 'payment_entitlement_projection',
      subjectUserId: 'user_1',
      action: 'user.role_projection_requested',
      resourceType: 'user',
      resourceId: 'user_1',
      eventKey: 'user-role:user_1:PREMIUM:period-end',
      details: { fromRole: 'USER', toRole: 'PREMIUM' },
    },
  ] as const)('accepts allow-listed action $action', async (input) => {
    await service.append(input);

    expect(client.$executeRaw).toHaveBeenCalledOnce();
  });

  it('rejects invalid refund amount and currency values before PostgreSQL', async () => {
    await expect(
      service.append({
        ...event,
        details: { chargeId: 'charge_1', amountMinor: 0, currency: 'INR' },
      })
    ).rejects.toThrow('Refund request audit details are invalid');
    await expect(
      service.append({
        ...event,
        details: { chargeId: 'charge_1', amountMinor: 100, currency: 'inr' },
      })
    ).rejects.toThrow('Refund request audit details are invalid');

    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects mismatched resources, absent keys, oversized fields, and oversized details', async () => {
    await expect(
      service.append({ ...event, action: 'user.account_deleted', resourceType: 'payment_refund' })
    ).rejects.toThrow('Audit action and resource type are not allow-listed');
    await expect(service.append({ ...event, eventKey: 'e'.repeat(513) })).rejects.toThrow(
      'Audit event field exceeds the allowed size'
    );
    await expect(
      service.append({ ...event, eventKey: undefined } as unknown as IAuditLogInput)
    ).rejects.toThrow('Audit event key is required');
    await expect(
      service.append({ ...event, details: { payload: 'x'.repeat(2100) } })
    ).rejects.toThrow('Audit details exceed the allowed size');

    expect(client.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects signature, provider event, role, and refund state values outside their allow-lists', async () => {
    const invalidInputs: IAuditLogInput[] = [
      {
        actorType: 'ANONYMOUS',
        action: 'webhook.signature_failed',
        resourceType: 'webhook',
        eventKey: 'webhook-signature:clerk:webhooks/clerk:1',
        details: { provider: 'CLERK', route: 'webhooks/razorpay' },
      },
      {
        actorType: 'PROVIDER',
        action: 'payment.webhook_received',
        resourceType: 'payment_webhook_event',
        eventKey: 'payment-webhook:1',
        details: { eventType: 'user.created' },
      },
      {
        actorType: 'SYSTEM',
        action: 'user.role_projection_requested',
        resourceType: 'user',
        eventKey: 'role:1',
        details: { fromRole: 'USER', toRole: 'ROOT' },
      },
      {
        actorType: 'PROVIDER',
        action: 'payment.refund_state_changed',
        resourceType: 'payment_refund',
        eventKey: 'refund-state:1',
        details: { status: 'unknown' },
      },
    ];

    for (const input of invalidInputs) await expect(service.append(input)).rejects.toThrow();

    expect(client.$executeRaw).not.toHaveBeenCalled();
  });
});
