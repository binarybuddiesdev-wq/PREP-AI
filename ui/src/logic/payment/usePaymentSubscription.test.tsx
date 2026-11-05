import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPaymentSubscription } from '@/core';
import {
  cancelCurrentSubscription,
  createSubscription,
  getCurrentSubscription,
} from '@/service/api';

import { codingKeys } from '../coding';
import { theoryKeys } from '../theory';
import { userKeys } from '../user';
import { paymentKeys } from './payment.keys';
import { useCurrentSubscriptionReader } from './useCurrentSubscriptionReader';
import { usePaymentCommands } from './usePaymentCommands';

const session = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  cancelCurrentSubscription: vi.fn(),
  createSubscription: vi.fn(),
  getCurrentSubscription: vi.fn(),
}));

const subscription: IPaymentSubscription = {
  id: 'sub-1',
  plan: 'monthly',
  status: 'created',
  cancelAtPeriodEnd: false,
  checkoutUrl: 'https://rzp.io/i/test',
  currentPeriodStart: null,
  currentPeriodEnd: null,
  createdAt: '2026-11-05T00:00:00.000Z',
};
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('payment subscription logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  afterEach(() => vi.useRealTimers());

  it('waits for Clerk and the Plan tab before loading the current subscription', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = { enabled: false };
    const { result, rerender } = renderHook(() => useCurrentSubscriptionReader(options.enabled), {
      wrapper: createWrapper(queryClient),
    });
    vi.mocked(getCurrentSubscription).mockResolvedValue({
      success: true,
      message: 'ok',
      data: subscription,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCurrentSubscription).not.toHaveBeenCalled();

    session.isLoaded = true;
    await act(async () => rerender());
    expect(result.current.fetchStatus).toBe('idle');

    options.enabled = true;
    await act(async () => rerender());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(subscription);
  });

  it('does not read subscription state for a signed-out user', () => {
    session.isLoaded = true;
    session.isSignedIn = false;
    const { result } = renderHook(() => useCurrentSubscriptionReader(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCurrentSubscription).not.toHaveBeenCalled();
  });

  it('polls the current subscription while payment confirmation is pending', async () => {
    vi.useFakeTimers();
    session.isLoaded = true;
    vi.mocked(getCurrentSubscription).mockResolvedValue({
      success: true,
      message: 'ok',
      data: { ...subscription, status: 'pending' },
    });
    const { result } = renderHook(() => useCurrentSubscriptionReader(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getCurrentSubscription).toHaveBeenCalledTimes(1);
    expect(result.current.data?.status).toBe('pending');

    await act(async () => vi.advanceTimersByTimeAsync(8_000));

    expect(getCurrentSubscription).toHaveBeenCalledTimes(2);
  });

  it('retries a timed-out create with the exact same idempotency key and invalidates plan state', async () => {
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const userId = 'user-one';
    for (const queryKey of [
      paymentKeys.subscription(userId),
      userKeys.me(),
      theoryKeys.stats(userId),
      codingKeys.stats(userId),
    ]) {
      queryClient.setQueryData(queryKey, {});
    }
    const { result } = renderHook(() => usePaymentCommands(), {
      wrapper: createWrapper(queryClient),
    });
    vi.mocked(createSubscription)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValue({ success: true, message: 'ok', data: subscription });

    await expect(
      act(async () =>
        result.current.create.mutateAsync({
          body: { plan: 'monthly' },
          idempotencyKey: 'stable-retry-key',
        })
      )
    ).rejects.toThrow('Network timeout');
    await act(async () =>
      result.current.create.mutateAsync({
        body: { plan: 'monthly' },
        idempotencyKey: 'stable-retry-key',
      })
    );

    expect(createSubscription).toHaveBeenNthCalledWith(
      1,
      {},
      { plan: 'monthly' },
      'stable-retry-key'
    );
    expect(createSubscription).toHaveBeenNthCalledWith(
      2,
      {},
      { plan: 'monthly' },
      'stable-retry-key'
    );
    for (const queryKey of [
      paymentKeys.subscription(userId),
      userKeys.me(),
      theoryKeys.stats(userId),
      codingKeys.stats(userId),
    ]) {
      expect(queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated).toBe(true);
    }
  });

  it('schedules cancellation and invalidates plan state', async () => {
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const userId = 'user-one';
    for (const queryKey of [
      paymentKeys.subscription(userId),
      userKeys.me(),
      theoryKeys.stats(userId),
      codingKeys.stats(userId),
    ]) {
      queryClient.setQueryData(queryKey, {});
    }
    const { result } = renderHook(() => usePaymentCommands(), {
      wrapper: createWrapper(queryClient),
    });
    vi.mocked(cancelCurrentSubscription).mockResolvedValue({
      success: true,
      message: 'ok',
      data: { ...subscription, cancelAtPeriodEnd: true },
    });

    await act(async () => result.current.cancel.mutateAsync());

    expect(cancelCurrentSubscription).toHaveBeenCalledWith({});
    for (const queryKey of [
      paymentKeys.subscription(userId),
      userKeys.me(),
      theoryKeys.stats(userId),
      codingKeys.stats(userId),
    ]) {
      expect(queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated).toBe(true);
    }
  });
});
