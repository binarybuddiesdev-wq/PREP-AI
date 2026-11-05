import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import type {
  ICodingExecutionAccepted,
  ICodingSession,
  IExecuteCodingBody,
  IStartCodingSessionBody,
} from '@/core';
import { runCodingCode, startCodingSession, submitCodingSolution } from '@/service/api';
import { useApiClient } from '../api';

export interface IStartCodingSessionVariables {
  body: IStartCodingSessionBody;
  idempotencyKey: string;
}

export interface IExecuteCodingVariables {
  operation: 'run' | 'submit';
  sessionId: string;
  body: IExecuteCodingBody;
  idempotencyKey: string;
}

export const useCodingSessionCommand = (): UseMutationResult<
  ICodingSession,
  Error,
  IStartCodingSessionVariables
> => {
  const api = useApiClient();

  return useMutation({
    mutationFn: async ({ body, idempotencyKey }) =>
      (await startCodingSession(api, body, idempotencyKey)).data,
  });
};

export const useCodingExecutionCommand = (): UseMutationResult<
  ICodingExecutionAccepted,
  Error,
  IExecuteCodingVariables
> => {
  const api = useApiClient();

  return useMutation({
    mutationFn: async ({ operation, sessionId, body, idempotencyKey }) =>
      (
        await (operation === 'run'
          ? runCodingCode(api, sessionId, body, idempotencyKey)
          : submitCodingSolution(api, sessionId, body, idempotencyKey))
      ).data,
  });
};
