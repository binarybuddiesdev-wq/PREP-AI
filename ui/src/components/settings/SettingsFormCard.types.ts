import type { ISettingsFormValues, ISettingsSaveStatus } from '@/core';

export interface ISettingsFormCardProps {
  values: ISettingsFormValues;
  isSaving: boolean;
  status: ISettingsSaveStatus | null;
  onChange: (values: ISettingsFormValues) => void;
  onSave: () => void;
}
