import { useMemo } from 'react';

import { usePracticeTopicsReader } from '../theory/usePracticeTopicsReader';
import { findGlobalSearchResults } from './searchResults';

export const useGlobalSearch = (query: string, isOpen: boolean) => {
  const topicsQuery = usePracticeTopicsReader(isOpen);
  const results = useMemo(
    () => findGlobalSearchResults(query, topicsQuery.data ?? []),
    [query, topicsQuery.data]
  );

  return {
    results,
    isLoading: isOpen && topicsQuery.isPending,
    errorMessage: topicsQuery.isError ? 'Practice topics could not be loaded.' : null,
    retry: topicsQuery.refetch,
  };
};
