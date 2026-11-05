import type { ISettingsFormValues } from '@/core';

export interface ISettingsNotificationsPanelProps {
  values: ISettingsFormValues;
  isSaving: boolean;
  onChange: (values: ISettingsFormValues) => void;
}
