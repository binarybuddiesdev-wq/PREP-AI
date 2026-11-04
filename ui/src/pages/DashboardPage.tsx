import type { UseQueryResult } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router';

import { DashboardOverview, type IDashboardPanelStatus } from '@/components/dashboard';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { historySessionDetailPath, ROUTES } from '@/core';
import {
  getHttpStatus,
  useDashboardDataReader,
  useSessionReader,
  useSettingsReader,
  useUserReader,
} from '@/logic';

const toPanelStatus = <TData,>(query: UseQueryResult<TData, Error>): IDashboardPanelStatus => ({
  isPending: query.isPending,
  isError: query.isError,
  isFetching: query.isFetching,
  error: query.error,
  onRetry: () => void query.refetch(),
});

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { isLoaded, user } = useSessionReader();
  // Fetching the profile is what syncs the Clerk user into the backend on first sign-in.
  const userQuery = useUserReader();
  const settingsQuery = useSettingsReader();
  const dashboard = useDashboardDataReader(
    settingsQuery.data,
    !userQuery.isPending && !userQuery.isError && !userQuery.data?.isNewUser
  );
  const profileErrorStatus = userQuery.error ? getHttpStatus(userQuery.error) : undefined;

  if (!isLoaded || userQuery.isPending) {
    return <LoadingScreen label="Loading your dashboard..." layout="embedded" />;
  }

  if (!userQuery.isError && userQuery.data?.isNewUser) {
    return <Navigate to={ROUTES.onboarding} replace />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {userQuery.isError ? (
        <QueryErrorState
          title="Couldn’t load your profile"
          description={
            profileErrorStatus === 503
              ? userQuery.error.message
              : 'Your dashboard is available, but profile details could not be loaded. Check the API connection and try again.'
          }
          details={
            userQuery.error
              ? profileErrorStatus
                ? profileErrorStatus === 503
                  ? `HTTP ${profileErrorStatus}`
                  : `HTTP ${profileErrorStatus}: ${userQuery.error.message}`
                : `Network error: ${userQuery.error.message}`
              : undefined
          }
          onRetry={() => void userQuery.refetch()}
          isRetrying={userQuery.isFetching}
        />
      ) : (
        <DashboardOverview
          name={user?.firstName || user?.email || ''}
          summary={dashboard.summary}
          theoryStatus={toPanelStatus(dashboard.theorySessionsQuery)}
          codingStatus={toPanelStatus(dashboard.codingSessionsQuery)}
          scoreTrendStatus={toPanelStatus(dashboard.scoreTrendQuery)}
          weakAreasStatus={toPanelStatus(dashboard.weakAreasQuery)}
          practiceTopicsStatus={toPanelStatus(dashboard.practiceTopicsQuery)}
          settingsStatus={toPanelStatus(settingsQuery)}
          onOpenSession={(sessionId) => navigate(historySessionDetailPath(sessionId))}
        />
      )}
    </div>
  );
};
