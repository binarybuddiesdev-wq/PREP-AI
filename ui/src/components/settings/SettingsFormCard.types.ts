import type { ISettingsFormValues, ISettingsSaveStatus } from '@/core';

export interface ISettingsFormCardProps {
  values: ISettingsFormValues;
  userName: string;
  userEmail: string;
  isSaving: boolean;
  status: ISettingsSaveStatus | null;
  onChange: (values: ISettingsFormValues) => void;
  onSave: () => void;
  onOpenDocuments: () => void;
}

export type SettingsTab = 'profile' | 'notifications' | 'preferences' | 'documents';
