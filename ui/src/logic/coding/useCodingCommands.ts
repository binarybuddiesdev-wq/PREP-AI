import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type {
  ICodingExecution,
  ICodingExecutionAccepted,
  ICodingReviewResponse,
  ICodingSession,
  IExecuteCodingBody,
  IStartCodingSessionBody,
} from '@/core';
import {
  requestCodingReview,
  runCodingCode,
  startCodingSession,
  submitCodingSolution,
} from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { codingKeys } from './coding.keys';

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

export interface IRequestCodingReviewVariables {
  sessionId: string;
  executionId: string;
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

export const useCodingReviewCommand = (): UseMutationResult<
  ICodingReviewResponse,
  Error,
  IRequestCodingReviewVariables
> => {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { user } = useSessionReader();
  const userId = user?.id ?? '';

  return useMutation({
    mutationFn: async ({ sessionId, executionId }) =>
      (await requestCodingReview(api, sessionId, executionId)).data,
    onSuccess: (review, { sessionId, executionId }) => {
      const queryKey = codingKeys.execution(userId, sessionId, executionId);
      queryClient.setQueryData<ICodingExecution>(queryKey, (current) =>
        current?.answer
          ? {
              ...current,
              answer: {
                ...current.answer,
                aiReviewStatus: review.status,
                aiReviewJson: review.aiReviewJson,
                aiReviewFailureMessage: review.aiReviewFailureMessage,
              },
            }
          : current
      );
      return queryClient.invalidateQueries({ queryKey });
    },
  });
};
