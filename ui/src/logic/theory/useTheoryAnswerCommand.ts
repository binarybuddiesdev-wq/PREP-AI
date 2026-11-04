import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import type { ISubmitTheoryAnswerBody, ITheoryAnswer } from '@/core';
import { submitTheoryAnswer } from '@/service/api';
import { useApiClient } from '../api';

export interface ISubmitTheoryAnswerVariables {
  sessionId: string;
  body: ISubmitTheoryAnswerBody;
  idempotencyKey: string;
}

export const useTheoryAnswerCommand = (): UseMutationResult<
  ITheoryAnswer,
  Error,
  ISubmitTheoryAnswerVariables
> => {
  const api = useApiClient();

  return useMutation<ITheoryAnswer, Error, ISubmitTheoryAnswerVariables>({
    mutationFn: async ({ sessionId, body, idempotencyKey }) =>
      (await submitTheoryAnswer(api, sessionId, body, idempotencyKey)).data,
  });
};
