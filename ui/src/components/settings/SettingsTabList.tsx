import { useRef, type KeyboardEvent } from 'react';

import { SETTINGS_TABS } from './settings.constants';
import type { ISettingsTabListProps } from './SettingsTabList.types';

export const SettingsTabList = (props: ISettingsTabListProps) => {
  const { activeTab, onChange } = props;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!direction) return;

    event.preventDefault();
    const nextIndex = (index + direction + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    onChange(SETTINGS_TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-1">
      {SETTINGS_TABS.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          id={`settings-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`settings-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`mb-[-1px] min-h-10 rounded-t-lg border-b-2 px-4 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent-strong)] sm:px-5 sm:text-sm ${
            activeTab === tab.id
              ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
              : 'border-transparent text-[var(--dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
