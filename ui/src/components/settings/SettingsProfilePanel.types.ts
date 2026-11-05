import type { ISettingsFormValues } from '@/core';

export interface ISettingsProfilePanelProps {
  values: ISettingsFormValues;
  userName: string;
  userEmail: string;
  isSaving: boolean;
  onChange: (values: ISettingsFormValues) => void;
}
