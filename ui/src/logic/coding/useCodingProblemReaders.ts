import { useQuery } from '@tanstack/react-query';

import { getCodingProblem, getCodingProblems } from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { codingKeys } from './coding.keys';

export const useCodingProblemsReader = () => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: codingKeys.problems(userId),
    queryFn: async () => (await getCodingProblems(api)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId),
  });
};

export const useCodingProblemReader = (problemIdOrSlug: string) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';

  return useQuery({
    queryKey: codingKeys.problem(userId, problemIdOrSlug),
    queryFn: async () => (await getCodingProblem(api, problemIdOrSlug)).data,
    enabled: isLoaded && isSignedIn && Boolean(userId) && Boolean(problemIdOrSlug),
  });
};
