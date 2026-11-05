import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { SettingsFormCard, SettingsPlanPanel, type SettingsTab } from '@/components/settings';
import { ROUTES, type ISettingsFormValues, type ISettingsSaveStatus } from '@/core';
import {
  getSettingsFormValues,
  toUpdateSettingsBody,
  useSessionReader,
  useCodingStatsReader,
  useCurrentSubscriptionReader,
  usePaymentCommands,
  useSettingsReader,
  useTheoryStatsReader,
  useUpdateSettingsCommand,
  useUserReader,
} from '@/logic';

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { isLoaded, user } = useSessionReader();
  const userQuery = useUserReader();
  const settingsQuery = useSettingsReader();
  const updateSettings = useUpdateSettingsCommand();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [checkoutRequest, setCheckoutRequest] = useState<{
    plan: 'monthly' | 'yearly';
    idempotencyKey: string;
  } | null>(null);
  const isPlanTab = activeTab === 'plan';
  const theoryStatsQuery = useTheoryStatsReader(isPlanTab);
  const codingStatsQuery = useCodingStatsReader(isPlanTab);
  const subscriptionQuery = useCurrentSubscriptionReader(isPlanTab);
  const paymentCommands = usePaymentCommands();
  const [draft, setDraft] = useState<ISettingsFormValues | null>(null);
  const [status, setStatus] = useState<ISettingsSaveStatus | null>(null);

  if (!isLoaded || userQuery.isPending || settingsQuery.isPending) {
    return <LoadingScreen label="Loading settings..." layout="embedded" />;
  }

  if (userQuery.isError || settingsQuery.isError) {
    const failedResource = userQuery.isError ? 'profile' : 'settings';
    const errorMessage =
      userQuery.error?.message ?? settingsQuery.error?.message ?? 'Request failed';

    return (
      <main className="mx-auto w-full max-w-2xl">
        <QueryErrorState
          title={`Couldn’t load your ${failedResource}`}
          description="Check your connection and try again. If the problem continues, share the technical detail with your support team."
          onRetry={() => {
            if (userQuery.isError) void userQuery.refetch();
            if (settingsQuery.isError) void settingsQuery.refetch();
          }}
          isRetrying={userQuery.isFetching || settingsQuery.isFetching}
        />
        <details className="app-shell-panel mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-left">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">
            Technical detail
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-zinc-500">
            {errorMessage}
          </pre>
        </details>
      </main>
    );
  }

  const values = draft ?? getSettingsFormValues(settingsQuery.data);

  const handleSave = () => {
    setStatus(null);
    updateSettings.mutate(toUpdateSettingsBody(values, settingsQuery.data), {
      onSuccess: () => {
        setDraft(null);
        setStatus({ kind: 'success', message: 'Settings saved successfully!' });
      },
      onError: (error) =>
        setStatus({
          kind: 'error',
          message: error.message || 'Settings could not be saved. Please try again.',
        }),
    });
  };

  const handleCreateCheckout = (plan: 'monthly' | 'yearly') => {
    const request =
      checkoutRequest?.plan === plan
        ? checkoutRequest
        : { plan, idempotencyKey: crypto.randomUUID() };
    setCheckoutRequest(request);
    paymentCommands.create.mutate({ body: { plan }, idempotencyKey: request.idempotencyKey });
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
        createErrorMessage: paymentCommands.create.isError
          ? planErrorMessage(paymentCommands.create.error, 'Checkout could not be started.')
          : null,
        createdSubscription: paymentCommands.create.data ?? null,
        isCreating: paymentCommands.create.isPending,
        cancelErrorMessage: paymentCommands.cancel.isError
          ? planErrorMessage(paymentCommands.cancel.error, 'Cancellation could not be scheduled.')
          : null,
        isCancelling: paymentCommands.cancel.isPending,
        onRetry: () => void subscriptionQuery.refetch(),
        onCreateCheckout: handleCreateCheckout,
        onCancelSubscription: () => paymentCommands.cancel.mutate(),
      }}
    />
  );

  return (
    <main className="-mt-2 mx-auto w-full max-w-3xl">
      <SettingsFormCard
        values={values}
        userName={userQuery.data.name}
        userEmail={user?.email || userQuery.data.email}
        isSaving={updateSettings.isPending}
        status={status}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        planPanel={planPanel}
        onChange={(nextValues) => {
          setDraft(nextValues);
          setStatus(null);
        }}
        onSave={handleSave}
        onOpenDocuments={() => navigate(ROUTES.settingsDocuments)}
      />
    </main>
  );
};
