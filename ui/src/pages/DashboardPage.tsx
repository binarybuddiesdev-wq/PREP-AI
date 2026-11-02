import { DashboardActions, InfoCard, WelcomeHeading } from '@/components/dashboard';
import { AppHeader, LoadingScreen, QueryErrorState } from '@/components/layout';
import { ROUTES } from '@/core';
import { getHttpStatus, useSessionReader, useSignOutCommand, useUserReader } from '@/logic';
import { UserMenu } from '@/service/auth';
import { formatDate } from '@/utils';

export const DashboardPage = () => {
  const { isLoaded, user } = useSessionReader();
  const signOut = useSignOutCommand();
  // Fetching the profile is what syncs the Clerk user into the backend on first sign-in.
  const userQuery = useUserReader();
  const profileErrorStatus = userQuery.error ? getHttpStatus(userQuery.error) : undefined;

  if (!isLoaded || userQuery.isPending) {
    return <LoadingScreen label="Loading your dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <AppHeader brandTo={ROUTES.root} maxWidthClassName="max-w-6xl">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{user?.email}</span>
          <UserMenu />
        </div>
      </AppHeader>

      <main className="max-w-6xl mx-auto px-6 py-12">
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

        <DashboardActions settingsTo={ROUTES.settings} onSignOut={() => void signOut()} />
      </main>
    </div>
  );
};
