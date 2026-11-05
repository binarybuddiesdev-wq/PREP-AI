import { useState } from 'react';
import { ArrowUpRight, Check, LoaderCircle, ShieldCheck } from 'lucide-react';

import type { IPaymentSubscription, PaymentPlan } from '@/core';
import { formatDate, safeRazorpayCheckoutUrl } from '@/utils';

import type { ISettingsPlanPanelProps } from './SettingsPlanPanel.types';
import { SettingsUsageMetric } from './SettingsUsageMetric';

const PLAN_OPTIONS: readonly { plan: PaymentPlan; period: string; detail: string }[] = [
  { plan: 'monthly', period: 'Monthly', detail: 'Billed monthly' },
  { plan: 'yearly', period: 'Yearly', detail: 'Billed yearly' },
];

const getPlanLabel = (role: string): string => {
  if (role === 'ADMIN') return 'Admin access';
  return role === 'PREMIUM' ? 'Premium plan' : 'Free plan';
};

const getSubscriptionLabel = (subscription: IPaymentSubscription): string => {
  if (subscription.cancelAtPeriodEnd) return 'Cancellation scheduled';
  switch (subscription.status) {
    case 'creating':
      return 'Preparing checkout';
    case 'created':
      return 'Checkout ready';
    case 'authenticated':
      return 'Payment confirmation pending';
    case 'active':
      return 'Active';
    case 'pending':
      return 'Payment pending';
    case 'halted':
      return 'Payment needs attention';
    case 'paused':
      return 'Paused';
    case 'cancelled':
      return 'Cancelled';
    case 'completed':
      return 'Completed';
    case 'expired':
      return 'Expired';
  }
};

export const SettingsPlanPanel = (props: ISettingsPlanPanelProps) => {
  const { role, usage, billing } = props;
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan>('yearly');
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const subscription = billing.subscription ?? billing.createdSubscription;
  const checkoutUrl = safeRazorpayCheckoutUrl(subscription?.checkoutUrl);
  const canCancel =
    role === 'PREMIUM' && subscription?.status === 'active' && !subscription.cancelAtPeriodEnd;
  const premiumEndDate = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : null;
  const isSubscriptionInProgress =
    Boolean(subscription) &&
    !['cancelled', 'completed', 'expired'].includes(subscription?.status ?? '');

  return (
    <section aria-label="Plan and billing" className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Your Plan</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Your access and daily limits are managed by PrepAI.
        </p>
      </div>

      <section
        aria-label="Current plan"
        className="rounded-xl border border-white/[0.08] bg-[#141416] p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex min-h-7 items-center rounded-lg px-2.5 text-[11px] font-bold uppercase tracking-wide ${role === 'PREMIUM' || role === 'ADMIN' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/[0.06] text-zinc-300'}`}
          >
            {role === 'ADMIN' ? 'Admin' : role === 'PREMIUM' ? 'Premium' : 'Free'}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-zinc-100">{getPlanLabel(role)}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {role === 'PREMIUM'
                ? 'Your Premium access is controlled by the server and payment status.'
                : role === 'ADMIN'
                  ? 'Administrative access includes all current product capabilities.'
                  : 'Your account is on the free plan. Upgrade to increase your daily limits.'}
            </p>
          </div>
          {(role === 'PREMIUM' || role === 'ADMIN') && (
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-amber-300" />
          )}
        </div>

        {billing.isLoading ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Loading subscription details
          </p>
        ) : billing.errorMessage ? (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-rose-200">{billing.errorMessage}</p>
            <button
              type="button"
              onClick={billing.onRetry}
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-amber-300 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Retry subscription
            </button>
          </div>
        ) : subscription ? (
          <div className="mt-4 border-t border-white/[0.08] pt-3">
            <p className="text-xs font-medium text-zinc-200">
              {getSubscriptionLabel(subscription)}
            </p>
            {subscription.cancelAtPeriodEnd && premiumEndDate && (
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Premium access remains available until {premiumEndDate}.
              </p>
            )}
            {subscription.status === 'active' && role !== 'PREMIUM' && (
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Razorpay reports an active subscription. PrepAI will apply Premium access after
                server verification.
              </p>
            )}
            {['creating', 'created', 'authenticated', 'pending', 'halted'].includes(
              subscription.status
            ) && (
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Payment is not confirmed yet. Your plan updates after Razorpay confirms it.
              </p>
            )}
          </div>
        ) : null}

        {checkoutUrl && (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-400/30 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Continue to secure checkout
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        )}
        {subscription && !checkoutUrl && ['creating', 'created'].includes(subscription.status) && (
          <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-rose-200">
              A secure checkout link is not available. Refresh the subscription before continuing.
            </p>
            <button
              type="button"
              onClick={billing.onRetry}
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-amber-300 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Refresh subscription
            </button>
          </div>
        )}

        {canCancel && (
          <div className="mt-4 border-t border-white/[0.08] pt-3">
            {isConfirmingCancellation ? (
              <div className="space-y-3" role="group" aria-label="Confirm cancellation">
                <p className="text-xs leading-5 text-zinc-300">
                  Cancellation takes effect at the end of the current paid period
                  {premiumEndDate ? ` on ${premiumEndDate}` : ''}. Premium remains available until
                  then.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={billing.isCancelling}
                    onClick={() => {
                      billing.onCancelSubscription();
                      setIsConfirmingCancellation(false);
                    }}
                    className="min-h-9 rounded-lg border border-rose-400/30 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-rose-300 disabled:opacity-60"
                  >
                    {billing.isCancelling ? 'Scheduling cancellation…' : 'Confirm cancellation'}
                  </button>
                  <button
                    type="button"
                    disabled={billing.isCancelling}
                    onClick={() => setIsConfirmingCancellation(false)}
                    className="min-h-9 rounded-lg px-3 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-60"
                  >
                    Keep Premium
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingCancellation(true)}
                className="min-h-9 rounded-lg px-2 text-xs font-semibold text-zinc-400 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-amber-300"
              >
                Cancel subscription
              </button>
            )}
            {billing.cancelErrorMessage && (
              <p role="alert" className="mt-2 text-xs text-rose-200">
                {billing.cancelErrorMessage}
              </p>
            )}
          </div>
        )}
      </section>

      <section aria-label="Daily limits" className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Daily limits</h3>
          <p className="mt-1 text-xs text-zinc-500">Usage and limits from your account today.</p>
        </div>
        {usage.isLoading ? (
          <div role="status" className="flex min-h-20 items-center gap-2 text-xs text-zinc-400">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Loading usage
          </div>
        ) : usage.errorMessage ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-rose-200">{usage.errorMessage}</p>
            <button
              type="button"
              onClick={usage.onRetry}
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-amber-300 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Retry usage
            </button>
          </div>
        ) : usage.theoryStats && usage.codingStats ? (
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SettingsUsageMetric
              label="Practice sessions today"
              value={`${usage.theoryStats.dailySessions.used} / ${usage.theoryStats.dailySessions.limit}`}
            />
            <SettingsUsageMetric
              label="Questions per session"
              value={`${usage.theoryStats.questionsPerSession} questions`}
            />
            <SettingsUsageMetric
              label="Coding problems today"
              value={`${usage.codingStats.dailySolved.used} / ${usage.codingStats.dailySolved.limit}`}
            />
            <SettingsUsageMetric
              label="AI reviews today"
              value={`${usage.codingStats.dailyReviews.used} / ${usage.codingStats.dailyReviews.limit}`}
            />
          </dl>
        ) : (
          <p className="rounded-lg border border-white/[0.08] px-3 py-3 text-xs text-zinc-400">
            Usage details are not available yet.
          </p>
        )}
      </section>

      {role !== 'PREMIUM' && role !== 'ADMIN' && !isSubscriptionInProgress && (
        <section aria-label="Upgrade plan" className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Upgrade to Premium</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Higher daily limits and access to the Premium features available in PrepAI.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PLAN_OPTIONS.map((option) => (
              <button
                key={option.plan}
                type="button"
                aria-pressed={selectedPlan === option.plan}
                onClick={() => setSelectedPlan(option.plan)}
                className={`min-h-20 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-amber-300 ${selectedPlan === option.plan ? 'border-amber-400/60 bg-amber-400/[0.06]' : 'border-white/[0.08] bg-[#141416] hover:border-white/20'}`}
              >
                <span className="flex items-center justify-between text-sm font-semibold text-zinc-100">
                  {option.period}
                  {selectedPlan === option.plan && (
                    <Check aria-hidden="true" className="size-4 text-amber-300" />
                  )}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">{option.detail}</span>
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-[11px] leading-5 text-zinc-500">
            <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" />
            Price is shown by Razorpay in its secure checkout.
          </p>
          <button
            type="button"
            disabled={billing.isCreating || Boolean(billing.createdSubscription)}
            onClick={() => billing.onCreateCheckout(selectedPlan)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            {billing.isCreating ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Starting checkout…
              </>
            ) : (
              'Upgrade to Premium'
            )}
          </button>
          {billing.createErrorMessage && (
            <p role="alert" className="text-xs leading-5 text-rose-200">
              {billing.createErrorMessage}
            </p>
          )}
        </section>
      )}
    </section>
  );
};
