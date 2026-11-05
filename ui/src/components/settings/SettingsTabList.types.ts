import type { SettingsTab } from './SettingsFormCard.types';

export interface ISettingsTabListProps {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}
