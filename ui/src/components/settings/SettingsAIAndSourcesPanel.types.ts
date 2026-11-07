import type { IPdfSource, ISettingsFormValues } from '@/core';

export interface ISettingsAIAndSourcesPanelProps {
  values: ISettingsFormValues;
  pdfSources: IPdfSource[];
  isLoading: boolean;
  errorMessage: string | null;
  deletingPdfId: string | null;
  onChange: (values: ISettingsFormValues) => void;
  onRetry: () => void;
  onDeletePdf: (pdfId: string) => void;
  onOpenDocuments: () => void;
}
