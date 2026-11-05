import type { ISettingsFormValues } from '@/core';

export interface ISettingsPracticePreferencesPanelProps {
  values: ISettingsFormValues;
  isSaving: boolean;
  onChange: (values: ISettingsFormValues) => void;
}
