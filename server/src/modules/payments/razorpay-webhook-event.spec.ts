import { describe, expect, it } from 'vitest';
import { parseRazorpaySubscriptionEvent } from './razorpay-webhook-event.js';

describe('Razorpay subscription webhook normalization', () => {
  it('extracts only the supported identifiers and signed notes', () => {
    const event = parseRazorpaySubscriptionEvent({
      event: 'subscription.activated',
      created_at: 1793793600,
      payload: {
        subscription: {
          entity: {
            id: 'sub_123',
            plan_id: 'plan_123',
            status: 'active',
            updated_at: 1793793600,
            notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
          },
        },
      },
    });
    expect(event).toEqual({
      eventType: 'subscription.activated',
      eventAt: new Date(1793793600 * 1000),
      subscriptionId: 'sub_123',
      planId: 'plan_123',
      status: 'active',
      updatedAt: new Date(1793793600 * 1000),
      userId: 'user_1',
      idempotencyKey: 'req_1',
      currentStart: null,
      currentEnd: null,
      charge: null,
    });
  });

  it('rejects unsupported or incomplete payloads', () => {
    expect(() => parseRazorpaySubscriptionEvent({ event: 'payment.captured' })).toThrow();
    expect(() =>
      parseRazorpaySubscriptionEvent({ event: 'subscription.activated', payload: {} })
    ).toThrow();
  });

  it('handles non-object inputs, missing event names, and optional invalid period fields', () => {
    expect(() => parseRazorpaySubscriptionEvent(null)).toThrow();
    expect(() => parseRazorpaySubscriptionEvent({ event: 1 })).toThrow();
    const event = parseRazorpaySubscriptionEvent({
      event: 'subscription.activated',
      created_at: 1793793600,
      payload: {
        subscription: {
          entity: {
            id: 'sub_123',
            plan_id: 'plan_123',
            status: 'active',
            updated_at: 1e20,
            current_start: 0,
            current_end: 'bad',
            notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
          },
        },
      },
    });
    expect(event.updatedAt).toEqual(new Date(1793793600 * 1000));
    expect(event.currentStart).toBeNull();
    expect(event.currentEnd).toBeNull();
  });

  it('projects only minimal fields from a captured subscription charge', () => {
    const event = parseRazorpaySubscriptionEvent({
      event: 'subscription.charged',
      created_at: 1793793600,
      payload: {
        subscription: {
          entity: {
            id: 'sub_123',
            plan_id: 'plan_123',
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
            card_id: 'card_private',
            contact: '+919999999999',
          },
        },
      },
    });

    expect(event.charge).toEqual({
      paymentId: 'pay_123',
      invoiceId: 'inv_123',
      amountMinor: 49900,
      currency: 'INR',
      chargedAt: new Date(1793793500 * 1000),
    });
    expect(JSON.stringify(event.charge)).not.toContain('card_private');
    expect(JSON.stringify(event.charge)).not.toContain('+919999999999');
  });

  it.each([
    {},
    {
      id: 'pay_123',
      amount: 100,
      currency: 'INR',
      status: 'failed',
      captured: false,
      created_at: 1,
    },
    {
      id: 'pay_123',
      amount: 0,
      currency: 'INR',
      status: 'captured',
      captured: true,
      created_at: 1,
    },
    {
      id: 'pay_123',
      amount: 2147483648,
      currency: 'INR',
      status: 'captured',
      captured: true,
      created_at: 1,
    },
    {
      id: 'pay_123',
      amount: 100,
      currency: 'inr',
      status: 'captured',
      captured: true,
      created_at: 1,
    },
    { id: 'pay_123', amount: 100, currency: 'INR', status: 'captured', captured: true },
  ])('rejects an incomplete or non-captured charge entity: %j', (payment) => {
    expect(() =>
      parseRazorpaySubscriptionEvent({
        event: 'subscription.charged',
        created_at: 1793793600,
        payload: {
          subscription: {
            entity: {
              id: 'sub_123',
              plan_id: 'plan_123',
              status: 'active',
              notes: { prepai_user_id: 'user_1', prepai_request_id: 'req_1' },
            },
          },
          payment: { entity: payment },
        },
      })
    ).toThrow();
  });
});
