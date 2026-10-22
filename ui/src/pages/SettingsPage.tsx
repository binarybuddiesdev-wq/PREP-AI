import { useState } from 'react';
import { Link } from 'react-router';
import { AppHeader, LoadingScreen } from '@/components/layout';
import { RawSettingsCard, SettingsFormCard, UserModelCard } from '@/components/settings';
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
  const { isLoaded } = useSessionReader();
  const userQuery = useUserReader();
  const settingsQuery = useSettingsReader();
  const updateSettings = useUpdateSettingsCommand();
  const [draft, setDraft] = useState<ISettingsFormValues | null>(null);
  const [status, setStatus] = useState<ISettingsSaveStatus | null>(null);

  if (!isLoaded || userQuery.isLoading || settingsQuery.isLoading) {
    return <LoadingScreen label="Loading settings..." />;
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
    <div className="min-h-screen bg-[#09090b] text-white">
      <AppHeader brandTo={ROUTES.dashboard} maxWidthClassName="max-w-4xl">
        <Link
          to={ROUTES.dashboard}
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Back to Dashboard
        </Link>
      </AppHeader>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-zinc-400 mb-8">Test both User and UserSettings models</p>

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
    </div>
  );
};
