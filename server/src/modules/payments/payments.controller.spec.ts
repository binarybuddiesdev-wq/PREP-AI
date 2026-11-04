import { describe, expect, it, vi } from 'vitest';
import { PaymentsController, RazorpayWebhookController } from './payments.controller.js';

describe('payment controllers', () => {
  it('passes authenticated subscription input to the payments service', async () => {
    const payments = {
      startSubscription: vi.fn().mockResolvedValue({ id: 'local_1' }),
      getCurrentSubscription: vi.fn().mockResolvedValue(null),
      cancelCurrentSubscription: vi
        .fn()
        .mockResolvedValue({ id: 'local_1', cancelAtPeriodEnd: true }),
    };
    const controller = new PaymentsController(payments as never);
    await expect(
      controller.createSubscription({ plan: 'monthly' }, 'user_1', 'req_1')
    ).resolves.toEqual({
      message: 'Subscription request accepted',
      data: { id: 'local_1' },
    });
    expect(payments.startSubscription).toHaveBeenCalledWith('user_1', { plan: 'monthly' }, 'req_1');
    await expect(controller.getCurrentSubscription('user_1')).resolves.toEqual({
      message: 'Current subscription fetched',
      data: null,
    });
    expect(payments.getCurrentSubscription).toHaveBeenCalledWith('user_1');
    await expect(controller.cancelCurrentSubscription('user_1')).resolves.toEqual({
      message: 'Subscription cancellation scheduled',
      data: { id: 'local_1', cancelAtPeriodEnd: true },
    });
    expect(payments.cancelCurrentSubscription).toHaveBeenCalledWith('user_1');
  });

  it('passes raw body and Razorpay headers to the webhook service', async () => {
    const payments = { acceptWebhook: vi.fn().mockResolvedValue({ received: true }) };
    const controller = new RazorpayWebhookController(payments as never);
    const rawBody = Buffer.from('{}');
    await expect(
      controller.receiveRazorpayWebhook({ rawBody } as never, 'signature', 'evt_1')
    ).resolves.toEqual({ message: 'Razorpay webhook accepted', data: { received: true } });
    expect(payments.acceptWebhook).toHaveBeenCalledWith(rawBody, 'signature', 'evt_1');
  });
});
