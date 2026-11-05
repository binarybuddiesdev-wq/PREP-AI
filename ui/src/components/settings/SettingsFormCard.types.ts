import type { ISettingsFormValues, ISettingsSaveStatus } from '@/core';
import type { ReactNode } from 'react';

export interface ISettingsFormCardProps {
  values: ISettingsFormValues;
  userName: string;
  userEmail: string;
  isSaving: boolean;
  status: ISettingsSaveStatus | null;
  onChange: (values: ISettingsFormValues) => void;
  onSave: () => void;
  onOpenDocuments: () => void;
  activeTab?: SettingsTab;
  onActiveTabChange?: (tab: SettingsTab) => void;
  planPanel?: ReactNode;
}

export type SettingsTab = 'profile' | 'notifications' | 'preferences' | 'documents' | 'plan';
