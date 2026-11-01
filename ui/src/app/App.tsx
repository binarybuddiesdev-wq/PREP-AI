import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';
import { IS_CLERK_CONFIGURATION_VALID } from '@/core';
import { ConfigurationErrorScreen } from '@/components/layout';
import { AppErrorBoundary } from './AppErrorBoundary';

export const App = () => {
  if (!IS_CLERK_CONFIGURATION_VALID) {
    return (
      <ConfigurationErrorScreen
        title="Clerk needs a valid Publishable Key"
        description="PrepAI can’t start the sign-in experience because the Clerk Publishable Key is missing or still set to a placeholder. Add the key for your Clerk application to continue."
        category="Setup required"
        actionLabel="Check again"
        onAction={() => window.location.reload()}
      />
    );
  }

  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </AppErrorBoundary>
  );
};
