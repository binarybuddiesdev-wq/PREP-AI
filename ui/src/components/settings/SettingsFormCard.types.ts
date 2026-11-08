import type { ISettingsFormValues, ISettingsSaveStatus } from '@/core';
import type { IPdfSource } from '@/core';
import type { ReactNode } from 'react';

export interface ISettingsFormCardProps {
  values: ISettingsFormValues;
  firstName: string;
  lastName: string;
  userEmail: string;
  isSaving: boolean;
  status: ISettingsSaveStatus | null;
  onChange: (values: ISettingsFormValues) => void;
  onIdentityChange: (profile: { firstName: string; lastName: string }) => void;
  onSave: () => void;
  onOpenDocuments: () => void;
  activeTab?: SettingsTab;
  onActiveTabChange?: (tab: SettingsTab) => void;
  planPanel?: ReactNode;
  pdfSources?: IPdfSource[];
  isLoadingPdfSources?: boolean;
  pdfSourcesError?: string | null;
  deletingPdfId?: string | null;
  onRetryPdfSources?: () => void;
  onDeletePdfSource?: (pdfId: string) => void;
}

export type SettingsTab =
  'profile' | 'notifications' | 'preferences' | 'ai' | 'documents' | 'plan' | 'danger';
