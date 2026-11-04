import type { ReactNode } from 'react';

import type { IOnboardingDraft, OnboardingStep } from '@/core';

export interface IOnboardingWizardProps {
  brand: ReactNode;
  step: OnboardingStep;
  values: IOnboardingDraft;
  isSaving: boolean;
  errorMessage: string | null;
  errorDetails: string | null;
  onChange: (values: IOnboardingDraft) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}
