export const ROUTES = {
  root: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  dashboard: '/dashboard',
  practice: '/practice',
  onboarding: '/onboarding',
  settings: '/settings',
} as const;

export const APP_SHELL_ROUTES = [ROUTES.dashboard, ROUTES.practice, ROUTES.settings] as const;
export type AppShellRoute = (typeof APP_SHELL_ROUTES)[number];
