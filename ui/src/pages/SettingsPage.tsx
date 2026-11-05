import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { SettingsFormCard } from '@/components/settings';
import { ROUTES, type ISettingsFormValues, type ISettingsSaveStatus } from '@/core';
import {
  getSettingsFormValues,
  toUpdateSettingsBody,
  useSessionReader,
  useSettingsReader,
  useUpdateSettingsCommand,
  useUserReader,
} from '@/logic';

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { isLoaded, user } = useSessionReader();
  const userQuery = useUserReader();
  const settingsQuery = useSettingsReader();
  const updateSettings = useUpdateSettingsCommand();
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

  return (
    <main className="-mt-2 mx-auto w-full max-w-3xl">
      <SettingsFormCard
        values={values}
        userName={userQuery.data.name}
        userEmail={user?.email || userQuery.data.email}
        isSaving={updateSettings.isPending}
        status={status}
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
