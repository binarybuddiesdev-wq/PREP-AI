import type { Theme, IGlobalSearchResult } from '@/core';

export interface IGlobalSearchProps {
  isOpen: boolean;
  query: string;
  results: IGlobalSearchResult[];
  isLoading: boolean;
  errorMessage: string | null;
  theme: Theme;
  onOpenChange: (isOpen: boolean) => void;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
  onSelect: (result: IGlobalSearchResult) => void;
}
