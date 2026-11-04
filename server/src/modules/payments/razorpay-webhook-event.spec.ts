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
});
