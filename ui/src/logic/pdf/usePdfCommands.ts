import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { IPdfReindexResult, IPdfSource, IPdfUploadProgress } from '@/core';
import { deletePdfSource, reindexPdfSource, uploadPdfSource } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { pdfKeys } from './pdf.keys';

export interface IUploadPdfVariables {
  file: File;
  idempotencyKey: string;
  onProgress?: (progress: IPdfUploadProgress) => void;
}

export interface IPdfSourceVariables {
  pdfId: string;
}

export interface IReindexPdfVariables extends IPdfSourceVariables {
  idempotencyKey: string;
}

export const usePdfUploadCommand = (): UseMutationResult<
  IPdfSource,
  Error,
  IUploadPdfVariables
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation({
    mutationFn: async ({ file, idempotencyKey, onProgress }) =>
      (await uploadPdfSource(api, file, idempotencyKey, onProgress)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pdfKeys.list(userId) }),
  });
};

export const usePdfReindexCommand = (): UseMutationResult<
  IPdfReindexResult,
  Error,
  IReindexPdfVariables
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation({
    mutationFn: async ({ pdfId, idempotencyKey }) =>
      (await reindexPdfSource(api, pdfId, idempotencyKey)).data,
    onSuccess: async (_, { pdfId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pdfKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: pdfKeys.source(userId, pdfId) }),
      ]);
    },
  });
};

export const usePdfDeleteCommand = (): UseMutationResult<
  Awaited<ReturnType<typeof deletePdfSource>>['data'],
  Error,
  IPdfSourceVariables
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation({
    mutationFn: async ({ pdfId }) => (await deletePdfSource(api, pdfId)).data,
    onSuccess: async (_, { pdfId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: pdfKeys.list(userId) }),
        queryClient.invalidateQueries({ queryKey: pdfKeys.source(userId, pdfId) }),
      ]);
    },
  });
};
