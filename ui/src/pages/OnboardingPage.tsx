import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { BrandLink, LoadingScreen, QueryErrorState } from '@/components/layout';
import { OnboardingWizard } from '@/components/onboarding';
import { ROUTES, type IOnboardingDraft, type OnboardingStep } from '@/core';
import {
  getOnboardingState,
  toOnboardingSettingsBody,
  useSessionReader,
  useSettingsReader,
  useSetupCompleteCommand,
  useThemePreference,
  useUpdateSettingsCommand,
  useUserReader,
} from '@/logic';

const SAVE_ERROR_MESSAGE = 'We couldn’t save your progress. Check your connection and try again.';
const COMPLETE_ERROR_MESSAGE = 'We couldn’t complete setup. Please try again.';

export const OnboardingPage = () => {
  useThemePreference();
  const navigate = useNavigate();
  const { isLoaded } = useSessionReader();
  const userQuery = useUserReader();
  const settingsQuery = useSettingsReader();
  const updateSettings = useUpdateSettingsCommand();
  const setupComplete = useSetupCompleteCommand();
  const [draft, setDraft] = useState<IOnboardingDraft | null>(null);
  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const savedState = getOnboardingState(settingsQuery.data);
  const values = draft ?? savedState.draft;
  const currentStep = step ?? savedState.step;
  const isSaving = updateSettings.isPending || setupComplete.isPending;

  const showActionError = (message: string, error: unknown) => {
    setErrorMessage(message);
    setErrorDetails(error instanceof Error ? error.message : null);
  };

  const clearActionError = () => {
    setErrorMessage(null);
    setErrorDetails(null);
  };

  const handleChange = (nextDraft: IOnboardingDraft) => {
    setDraft(nextDraft);
    clearActionError();
  };

  const handleContinue = async () => {
    if (currentStep === 1 && (!values.targetRole || !values.experienceLevel)) {
      setErrorMessage('Please select both a target role and experience level to continue.');
      setErrorDetails(null);
      return;
    }

    const nextStep: OnboardingStep = currentStep === 1 ? 2 : 3;
    clearActionError();

    try {
      await updateSettings.mutateAsync(
        toOnboardingSettingsBody(values, settingsQuery.data, nextStep)
      );
      setDraft(values);
      setStep(nextStep);
    } catch (error) {
      showActionError(SAVE_ERROR_MESSAGE, error);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) return;
    clearActionError();
    setStep(currentStep === 3 ? 2 : 1);
  };

  const handleSkip = async () => {
    clearActionError();

    try {
      await setupComplete.mutateAsync();
      navigate(ROUTES.dashboard, { replace: true });
    } catch (error) {
      showActionError(COMPLETE_ERROR_MESSAGE, error);
    }
  };

  const handleFinish = async () => {
    clearActionError();

    try {
      await updateSettings.mutateAsync(toOnboardingSettingsBody(values, settingsQuery.data, 3));
      await setupComplete.mutateAsync();
      navigate(ROUTES.dashboard, { replace: true });
    } catch (error) {
      showActionError(COMPLETE_ERROR_MESSAGE, error);
    }
  };

  if (!isLoaded || userQuery.isPending) {
    return <LoadingScreen label="Loading your setup..." />;
  }

  if (userQuery.isError) {
    return (
      <main className="min-h-svh bg-[#09090b] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-2xl">
          <QueryErrorState
            title="Couldn’t load your profile"
            description="We need your profile to prepare setup. Check your connection and try again."
            details={userQuery.error.message}
            onRetry={() => void userQuery.refetch()}
            isRetrying={userQuery.isFetching}
          />
        </div>
      </main>
    );
  }

  if (!userQuery.data.isNewUser) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (settingsQuery.isPending) {
    return <LoadingScreen label="Loading your saved setup..." />;
  }

  if (settingsQuery.isError) {
    return (
      <main className="min-h-svh bg-[#09090b] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-2xl">
          <QueryErrorState
            title="Couldn’t load your saved setup"
            description="Your saved progress could not be loaded. Check your connection and try again."
            details={settingsQuery.error.message}
            onRetry={() => void settingsQuery.refetch()}
            isRetrying={settingsQuery.isFetching}
          />
        </div>
      </main>
    );
  }

  return (
    <OnboardingWizard
      brand={<BrandLink to={ROUTES.root} size="small" />}
      step={currentStep}
      values={values}
      isSaving={isSaving}
      errorMessage={errorMessage}
      errorDetails={errorDetails}
      onChange={handleChange}
      onContinue={() => void handleContinue()}
      onBack={handleBack}
      onSkip={() => void handleSkip()}
      onFinish={() => void handleFinish()}
    />
  );
};
