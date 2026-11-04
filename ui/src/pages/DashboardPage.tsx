import { Navigate } from 'react-router';

import { InfoCard, WelcomeHeading } from '@/components/dashboard';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { ROUTES } from '@/core';
import { getHttpStatus, useSessionReader, useUserReader } from '@/logic';
import { formatDate } from '@/utils';

export const DashboardPage = () => {
  const { isLoaded, user } = useSessionReader();
  // Fetching the profile is what syncs the Clerk user into the backend on first sign-in.
  const userQuery = useUserReader();
  const profileErrorStatus = userQuery.error ? getHttpStatus(userQuery.error) : undefined;

  if (!isLoaded || userQuery.isPending) {
    return <LoadingScreen label="Loading your dashboard..." layout="embedded" />;
  }

  if (!userQuery.isError && userQuery.data?.isNewUser) {
    return <Navigate to={ROUTES.onboarding} replace />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl">
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
        <>
          <WelcomeHeading name={user?.firstName || user?.email || ''} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard title="User ID" value={user?.id ?? ''} isMonospace />
            <InfoCard title="Email" value={user?.email ?? ''} />
            <InfoCard
              title="Account Created"
              value={user?.createdAt ? formatDate(user.createdAt) : 'N/A'}
            />
          </div>
        </>
      )}
    </main>
  );
};
