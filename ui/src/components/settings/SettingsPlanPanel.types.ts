import type { ICodingStats, IPaymentSubscription, ITheoryStats, PaymentPlan } from '@/core';

export interface ISettingsPlanUsageProps {
  theoryStats: ITheoryStats | null;
  codingStats: ICodingStats | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

export interface ISettingsPlanBillingProps {
  subscription: IPaymentSubscription | null;
  isLoading: boolean;
  errorMessage: string | null;
  createErrorMessage: string | null;
  createdSubscription: IPaymentSubscription | null;
  isCreating: boolean;
  cancelErrorMessage: string | null;
  isCancelling: boolean;
  onRetry: () => void;
  onCreateCheckout: (plan: PaymentPlan) => void;
  onCancelSubscription: () => void;
}

export interface ISettingsPlanPanelProps {
  role: string;
  usage: ISettingsPlanUsageProps;
  billing: ISettingsPlanBillingProps;
}
