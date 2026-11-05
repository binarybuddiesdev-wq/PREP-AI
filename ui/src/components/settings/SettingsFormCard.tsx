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
    <section className="app-shell-panel overflow-hidden rounded-xl border border-white/10 bg-[#18181b]">
      <header className="border-b border-[var(--border)] px-4 pt-2 sm:px-5">
        <SettingsTabList activeTab={activeTab} onChange={changeActiveTab} />
      </header>

      <div
        id={`settings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        tabIndex={0}
        className="min-h-[12rem] px-4 py-3 outline-none sm:px-5 sm:py-5"
      >
        {getPanel()}
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

      {showSaveFooter && (
        <footer className="flex min-h-14 flex-wrap items-center gap-3 border-t border-[var(--border)] px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex min-h-9 items-center rounded-lg bg-amber-400 px-3 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save settings'}
          </button>
          {status && (
            <p
              role={status.kind === 'error' ? 'alert' : 'status'}
              className={`text-sm ${status.kind === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}
            >
              {status.message}
            </p>
          )}
        </footer>
      )}

      <span className="sr-only" aria-live="polite">
        Selected tab {SETTINGS_TABS[activeIndex].label}
      </span>
    </section>
  );
};
