import { useState } from 'react';

import type { ISettingsFormCardProps, SettingsTab } from './SettingsFormCard.types';
import { SettingsDocumentsPanel } from './SettingsDocumentsPanel';
import { SettingsNotificationsPanel } from './SettingsNotificationsPanel';
import { SettingsPracticePreferencesPanel } from './SettingsPracticePreferencesPanel';
import { SettingsProfilePanel } from './SettingsProfilePanel';
import { SETTINGS_TABS } from './settings.constants';
import { SettingsTabList } from './SettingsTabList';

export const SettingsFormCard = (props: ISettingsFormCardProps) => {
  const {
    values,
    userName,
    userEmail,
    isSaving,
    status,
    onChange,
    onSave,
    onOpenDocuments,
    planPanel,
    onActiveTabChange,
  } = props;
  const [internalActiveTab, setInternalActiveTab] = useState<SettingsTab>('profile');
  const activeTab = props.activeTab ?? internalActiveTab;
  const changeActiveTab = onActiveTabChange ?? setInternalActiveTab;
  const activeIndex = SETTINGS_TABS.findIndex((tab) => tab.id === activeTab);
  const isDocumentsTab = activeTab === 'documents';
  const showSaveFooter = !isDocumentsTab && activeTab !== 'plan';
  const saveActionLabel = activeTab === 'profile' ? 'Save Changes' : 'Save Preferences';
  const panelTitle =
    activeTab === 'plan'
      ? null
      : (SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? 'Settings');

  const getPanel = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <SettingsProfilePanel
            values={values}
            userName={userName}
            userEmail={userEmail}
            isSaving={isSaving}
            onChange={onChange}
          />
        );
      case 'notifications':
        return (
          <SettingsNotificationsPanel values={values} isSaving={isSaving} onChange={onChange} />
        );
      case 'preferences':
        return (
          <SettingsPracticePreferencesPanel
            values={values}
            isSaving={isSaving}
            onChange={onChange}
          />
        );
      case 'documents':
        return <SettingsDocumentsPanel onOpenDocuments={onOpenDocuments} />;
      case 'plan':
        return planPanel;
    }
  };

  return (
    <div className="w-full text-[var(--text)]">
      <header className="mb-6 border-b border-[var(--border)]">
        <SettingsTabList activeTab={activeTab} onChange={changeActiveTab} />
      </header>

      <section className="app-shell-panel overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div
          id={`settings-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeTab}`}
          tabIndex={0}
          className="min-h-[12rem] p-4 outline-none sm:p-8"
        >
          {panelTitle && (
            <h2 className="mb-6 text-[1.15rem] font-semibold text-[var(--text-h)]">{panelTitle}</h2>
          )}
          {getPanel()}
          {showSaveFooter && (
            <footer className="mt-5 flex min-h-9 flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex min-h-9 items-center rounded-lg bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : saveActionLabel}
              </button>
              {status && (
                <p
                  role={status.kind === 'error' ? 'alert' : 'status'}
                  className={`text-sm ${status.kind === 'success' ? 'text-[var(--success-strong)]' : 'text-[var(--danger-strong)]'}`}
                >
                  {status.message}
                </p>
              )}
            </footer>
          )}
        </div>
        {SETTINGS_TABS.filter((tab) => tab.id !== activeTab).map((tab) => (
          <div
            key={tab.id}
            id={`settings-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab.id}`}
            hidden
          />
        ))}
      </section>

      <span className="sr-only" aria-live="polite">
        Selected tab {SETTINGS_TABS[activeIndex].label}
      </span>
    </div>
  );
};
