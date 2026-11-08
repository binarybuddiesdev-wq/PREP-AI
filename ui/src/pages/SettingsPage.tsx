import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { SettingsFormCard, SettingsPlanPanel, type SettingsTab } from '@/components/settings';
import { ROUTES, type ISettingsFormValues, type ISettingsSaveStatus } from '@/core';
import {
  getSettingsFormValues,
  toUpdateSettingsBody,
  useSessionReader,
  useCodingStatsReader,
  useCurrentSubscriptionReader,
  usePdfDeleteCommand,
  usePdfSourcesReader,
  usePaymentCommands,
  useSettingsReader,
  useTheoryStatsReader,
  useUpdateSettingsCommand,
  useUpdateAuthProfileCommand,
  useToastCommand,
  useUserReader,
} from '@/logic';

const isSettingsTab = (value: string | null): value is SettingsTab =>
  value === 'profile' ||
  value === 'notifications' ||
  value === 'preferences' ||
  value === 'ai' ||
  value === 'documents' ||
  value === 'plan' ||
  value === 'danger';

export const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const { isLoaded, user } = useSessionReader();
  const userQuery = useUserReader();
  const settingsQuery = useSettingsReader();
  const updateSettings = useUpdateSettingsCommand();
  const updateAuthProfile = useUpdateAuthProfileCommand();
  const toast = useToastCommand();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    isSettingsTab(requestedTab) ? requestedTab : 'profile'
  );
  const [checkoutRequest, setCheckoutRequest] = useState<{
    plan: 'monthly' | 'yearly';
    idempotencyKey: string;
  } | null>(null);
  const isPlanTab = activeTab === 'plan';
  const isAiTab = activeTab === 'ai';
  const pdfSourcesQuery = usePdfSourcesReader(20, isAiTab);
  const deletePdfSource = usePdfDeleteCommand();
  const theoryStatsQuery = useTheoryStatsReader(isPlanTab);
  const codingStatsQuery = useCodingStatsReader(isPlanTab);
  const subscriptionQuery = useCurrentSubscriptionReader(isPlanTab);
  const paymentCommands = usePaymentCommands();
  const [draft, setDraft] = useState<ISettingsFormValues | null>(null);
  const [identityDraft, setIdentityDraft] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);
  const [status, setStatus] = useState<ISettingsSaveStatus | null>(null);

  useEffect(() => {
    if (isSettingsTab(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);

  if (!isLoaded || userQuery.isPending || settingsQuery.isPending) {
    return <LoadingScreen label="Loading settings..." layout="embedded" />;
  }

  if (userQuery.isError || settingsQuery.isError) {
    const failedResource = userQuery.isError ? 'profile' : 'settings';
    const errorMessage =
      userQuery.error?.message ?? settingsQuery.error?.message ?? 'Request failed';

    return (
      <main className="mx-auto w-full">
        <header className="mb-6">
          <h1 className="mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]">Settings</h1>
          <p className="text-[0.9rem] text-[var(--dim)]">Manage your profile and preferences</p>
        </header>
        <div className="mx-auto w-full max-w-3xl">
          <QueryErrorState
            title={`Couldn’t load your ${failedResource}`}
            description="Check your connection and try again. If the problem continues, share the technical detail with your support team."
            onRetry={() => {
              if (userQuery.isError) void userQuery.refetch();
              if (settingsQuery.isError) void settingsQuery.refetch();
            }}
            isRetrying={userQuery.isFetching || settingsQuery.isFetching}
          />
          <details className="app-shell-panel mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left">
            <summary className="cursor-pointer text-xs font-medium text-[var(--dim)]">
              Technical detail
            </summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-[var(--dim)]">
              {errorMessage}
            </pre>
          </details>
        </div>
      </main>
    );
  }

  const values = draft ?? getSettingsFormValues(settingsQuery.data);
  const [fallbackFirstName = '', ...fallbackLastName] = userQuery.data.name.trim().split(/\s+/u);
  const originalIdentity = {
    firstName: user?.firstName ?? fallbackFirstName,
    lastName: user?.lastName ?? fallbackLastName.join(' '),
  };
  const identity = identityDraft ?? originalIdentity;
  const isSaving = updateSettings.isPending || updateAuthProfile.isPending;

  const handleSave = async () => {
    setStatus(null);
    let identitySaved = false;
    const hasIdentityChanges =
      identity.firstName.trim() !== originalIdentity.firstName.trim() ||
      identity.lastName.trim() !== originalIdentity.lastName.trim();
    try {
      if (hasIdentityChanges) {
        if (!identity.firstName.trim()) throw new Error('First name is required.');
        await updateAuthProfile.mutateAsync({
          firstName: identity.firstName.trim(),
          lastName: identity.lastName.trim(),
        });
        identitySaved = true;
      }
      if (draft !== null || !hasIdentityChanges) {
        await updateSettings.mutateAsync(toUpdateSettingsBody(values, settingsQuery.data));
      }
      setDraft(null);
      setIdentityDraft(null);
      setStatus(null);
      toast.success('Settings saved successfully.');
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Please check your connection and try again.';
      setStatus({
        kind: 'error',
        message: identitySaved
          ? `Your name was updated, but the rest of your settings could not be saved: ${detail}`
          : detail || 'Settings could not be saved. Please try again.',
      });
    }
  };

  const handleCreateCheckout = (plan: 'monthly' | 'yearly') => {
    const request =
      checkoutRequest?.plan === plan
        ? checkoutRequest
        : { plan, idempotencyKey: crypto.randomUUID() };
    setCheckoutRequest(request);
    paymentCommands.create.mutate(
      { body: { plan }, idempotencyKey: request.idempotencyKey },
      {
        onSuccess: () =>
          toast.success('Your secure checkout link is ready. Continue to Razorpay to finish.'),
      }
    );
  };

  const handleCancelSubscription = () => {
    paymentCommands.cancel.mutate(undefined, {
      onSuccess: () => toast.success('Your subscription cancellation request was submitted.'),
    });
  };

  const handleDeletePdfSource = (pdfId: string) => {
    const source = pdfSourcesQuery.data?.find((item) => item.id === pdfId);
    if (!source || !globalThis.confirm(`Remove ${source.displayName} from your PDF sources?`))
      return;
    setDraft((current) => ({
      ...(current ?? getSettingsFormValues(settingsQuery.data)),
      enabledPdfSourceIds: (
        current?.enabledPdfSourceIds ??
        pdfSourcesQuery.data?.filter((item) => item.status === 'ready').map((item) => item.id) ??
        []
      ).filter((id) => id !== pdfId),
    }));
    deletePdfSource.mutate(
      { pdfId },
      {
        onSuccess: () => toast.success('PDF source removed.'),
      }
    );
  };

  const planErrorMessage = (error: Error | null, fallback: string) =>
    error?.message.trim() || fallback;
  const planPanel = (
    <SettingsPlanPanel
      role={userQuery.data.role}
      usage={{
        theoryStats: theoryStatsQuery.data ?? null,
        codingStats: codingStatsQuery.data ?? null,
        isLoading: theoryStatsQuery.isPending || codingStatsQuery.isPending,
        errorMessage: theoryStatsQuery.isError
          ? planErrorMessage(theoryStatsQuery.error, 'Practice usage could not be loaded.')
          : codingStatsQuery.isError
            ? planErrorMessage(codingStatsQuery.error, 'Coding usage could not be loaded.')
            : null,
        onRetry: () => {
          if (theoryStatsQuery.isError) void theoryStatsQuery.refetch();
          if (codingStatsQuery.isError) void codingStatsQuery.refetch();
        },
      }}
      billing={{
        subscription: subscriptionQuery.data ?? null,
        isLoading: subscriptionQuery.isPending,
        errorMessage: subscriptionQuery.isError
          ? planErrorMessage(subscriptionQuery.error, 'Subscription details could not be loaded.')
          : null,
        createdSubscription: paymentCommands.create.data ?? null,
        isCreating: paymentCommands.create.isPending,
        cancelErrorMessage: paymentCommands.cancel.isError
          ? planErrorMessage(paymentCommands.cancel.error, 'Cancellation could not be scheduled.')
          : null,
        isCancelling: paymentCommands.cancel.isPending,
        onRetry: () => void subscriptionQuery.refetch(),
        onCreateCheckout: handleCreateCheckout,
        onCancelSubscription: handleCancelSubscription,
      }}
    />
  );

  return (
    <main className="mx-auto w-full">
      <header className="mb-6">
        <h1 className="mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]">Settings</h1>
        <p className="text-[0.9rem] text-[var(--dim)]">Manage your profile and preferences</p>
      </header>
      <SettingsFormCard
        values={values}
        firstName={identity.firstName}
        lastName={identity.lastName}
        userEmail={user?.email || userQuery.data.email}
        isSaving={isSaving}
        status={status}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        planPanel={planPanel}
        onChange={(nextValues) => {
          setDraft(nextValues);
          setStatus(null);
        }}
        onIdentityChange={(nextIdentity) => {
          setIdentityDraft(nextIdentity);
          setStatus(null);
        }}
        onSave={handleSave}
        onOpenDocuments={() => navigate(ROUTES.settingsDocuments)}
        pdfSources={pdfSourcesQuery.data ?? []}
        isLoadingPdfSources={pdfSourcesQuery.isLoading}
        pdfSourcesError={pdfSourcesQuery.isError ? pdfSourcesQuery.error.message : null}
        deletingPdfId={
          deletePdfSource.isPending ? (deletePdfSource.variables?.pdfId ?? null) : null
        }
        onRetryPdfSources={() => void pdfSourcesQuery.refetch()}
        onDeletePdfSource={handleDeletePdfSource}
      />
    </main>
  );
};
