import { useCallback } from 'react';

import { getPdfContent } from '@/service/api';
import { useApiClient } from '../api';

export const usePdfContentReader = () => {
  const api = useApiClient();
  return useCallback((pdfId: string) => getPdfContent(api, pdfId), [api]);
};
