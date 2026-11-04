import { useState } from 'react';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { RawSettingsCard, SettingsFormCard, UserModelCard } from '@/components/settings';
import { type ISettingsFormValues, type ISettingsSaveStatus } from '@/core';
import {
  getSettingsFormValues,
  toUpdateSettingsBody,
  useSessionReader,
  useSettingsReader,
  useUpdateSettingsCommand,
  useUserReader,
} from '@/logic';

export const SettingsPage = () => {
  const { isLoaded } = useSessionReader();
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
    updateSettings.mutate(toUpdateSettingsBody(values), {
      onSuccess: () => {
        setDraft(null);
        setStatus({ kind: 'success', message: 'Settings saved successfully!' });
      },
      onError: () => setStatus({ kind: 'error', message: 'Failed to save settings' }),
    });
  };

  return (
    <main className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-zinc-400 mb-8">Manage your profile and practice preferences.</p>

      <UserModelCard user={userQuery.data} />
      <SettingsFormCard
        values={values}
        isSaving={updateSettings.isPending}
        status={status}
        onChange={setDraft}
        onSave={handleSave}
      />
      <RawSettingsCard settings={settingsQuery.data} />
    </main>
  );
};
