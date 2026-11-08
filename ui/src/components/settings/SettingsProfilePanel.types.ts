import type { ISettingsFormValues } from '@/core';

export interface ISettingsProfilePanelProps {
  values: ISettingsFormValues;
  firstName: string;
  lastName: string;
  userEmail: string;
  isSaving: boolean;
  onIdentityChange: (profile: { firstName: string; lastName: string }) => void;
  onChange: (values: ISettingsFormValues) => void;
}
