import { useQuery } from '@tanstack/react-query';

import type { ICodingProblemSummary, ICodingSession, ITheorySession, IUserSettings } from '@/core';
import {
  getCodingProblems,
  getCodingSessionHistory,
  getPracticeTopics,
  getTheoryScoreTrend,
  getTheorySessionHistory,
  getTheoryWeakAreas,
} from '@/service/api';
import { useApiClient } from '../api';
import { useSessionReader } from '../auth';
import { codingKeys } from '../coding/coding.keys';
import { theoryKeys } from '../theory/theory.keys';
import { buildDashboardSummary } from './dashboardSummary';
import { dashboardKeys } from './dashboard.keys';

const HISTORY_PAGE_SIZE = 100;

const getAllTheorySessions = async (
  api: ReturnType<typeof useApiClient>
): Promise<ITheorySession[]> => {
  const sessions: ITheorySession[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (sessions.length < total) {
    const response = await getTheorySessionHistory(api, { page, limit: HISTORY_PAGE_SIZE });
    sessions.push(...response.data.sessions);
    total = response.data.total;
    if (response.data.sessions.length === 0) {
      if (sessions.length < total) {
        throw new Error('Theory session history is incomplete. Retry to load the full history.');
      }
      break;
    }
    page += 1;
  }

  return sessions;
};

const getAllCodingSessions = async (
  api: ReturnType<typeof useApiClient>
): Promise<ICodingSession[]> => {
  const sessions: ICodingSession[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (sessions.length < total) {
    const response = await getCodingSessionHistory(api, { page, limit: HISTORY_PAGE_SIZE });
    sessions.push(...response.data.sessions);
    total = response.data.total;
    if (response.data.sessions.length === 0) {
      if (sessions.length < total) {
        throw new Error('Coding session history is incomplete. Retry to load the full history.');
      }
      break;
    }
    page += 1;
  }

  return sessions;
};

export const useDashboardDataReader = (settings?: IUserSettings | null, shouldFetch = true) => {
  const api = useApiClient();
  const { isLoaded, isSignedIn, user } = useSessionReader();
  const userId = user?.id ?? '';
  const enabled = isLoaded && isSignedIn && Boolean(userId) && shouldFetch;
  const catalogEnabled = isLoaded && isSignedIn && Boolean(userId);

  const theorySessionsQuery = useQuery({
    queryKey: dashboardKeys.theoryHistory(userId),
    queryFn: () => getAllTheorySessions(api),
    enabled,
  });
  const codingSessionsQuery = useQuery({
    queryKey: dashboardKeys.codingHistory(userId),
    queryFn: () => getAllCodingSessions(api),
    enabled,
  });
  const codingProblemsQuery = useQuery({
    queryKey: codingKeys.problems(userId),
    queryFn: async () => (await getCodingProblems(api)).data,
    enabled: catalogEnabled,
  });
  const scoreTrendQuery = useQuery({
    queryKey: dashboardKeys.scoreTrend(userId),
    queryFn: async () => (await getTheoryScoreTrend(api, 7)).data,
    enabled,
  });
  const weakAreasQuery = useQuery({
    queryKey: dashboardKeys.weakAreas(userId),
    queryFn: async () => (await getTheoryWeakAreas(api)).data,
    enabled,
  });
  const practiceTopicsQuery = useQuery({
    queryKey: theoryKeys.practiceTopics(userId),
    queryFn: async () => (await getPracticeTopics(api)).data,
    enabled: catalogEnabled,
  });

  const theorySessions = theorySessionsQuery.data ?? [];
  const codingSessions = codingSessionsQuery.data ?? [];
  const topics = practiceTopicsQuery.data ?? [];
  const codingProblems: ICodingProblemSummary[] = codingProblemsQuery.data ?? [];
  const scoreTrend = scoreTrendQuery.data ?? [];
  const weakAreas = weakAreasQuery.data ?? [];

  return {
    theorySessionsQuery,
    codingSessionsQuery,
    codingProblemsQuery,
    scoreTrendQuery,
    weakAreasQuery,
    practiceTopicsQuery,
    practiceTopics: topics,
    codingProblems,
    summary: buildDashboardSummary({
      theorySessions,
      codingSessions,
      topics,
      scoreTrend,
      weakAreas,
      settings,
    }),
  };
};
