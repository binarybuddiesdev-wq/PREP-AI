import { useQuery } from '@tanstack/react-query';

import { getPdfSource, getPdfSources } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { pdfKeys } from './pdf.keys';

const PDF_POLL_INTERVAL_MS = 1500;
const INDEXING_STATUSES = new Set(['uploading', 'queued', 'processing']);

export const usePdfSourcesReader = (limit = 20, enabled = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: pdfKeys.list(userId),
    queryFn: async () => (await getPdfSources(api, limit)).data,
    enabled: enabled && isLoaded && isSignedIn && Boolean(userId),
    refetchInterval: (query) =>
      query.state.data?.some((source) => INDEXING_STATUSES.has(source.status))
        ? PDF_POLL_INTERVAL_MS
        : false,
  });
};

export const usePdfSourceReader = (pdfId: string) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: pdfKeys.source(userId, pdfId),
    queryFn: async () => (await getPdfSource(api, pdfId)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && Boolean(pdfId),
    refetchInterval: (query) =>
      query.state.data && INDEXING_STATUSES.has(query.state.data.status)
        ? PDF_POLL_INTERVAL_MS
        : false,
  });
};
