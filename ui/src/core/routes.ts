export const ROUTES = {
  root: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  dashboard: '/dashboard',
  practice: '/practice',
  history: '/history',
  historySessionDetail: '/history/:sessionId',
  onboarding: '/onboarding',
  settings: '/settings',
  settingsDocuments: '/settings/documents',
  library: '/library',
  coding: '/coding',
  codingProblem: '/coding/:problemId',
} as const;

export const historySessionDetailPath = (sessionId: string) =>
  `${ROUTES.history}/${encodeURIComponent(sessionId)}`;

export const codingProblemPath = (problemIdOrSlug: string) =>
  `${ROUTES.coding}/${encodeURIComponent(problemIdOrSlug)}`;

export const APP_SHELL_ROUTES = [
  ROUTES.dashboard,
  ROUTES.practice,
  ROUTES.history,
  ROUTES.settings,
  ROUTES.library,
  ROUTES.coding,
] as const;
export type AppShellRoute = (typeof APP_SHELL_ROUTES)[number];
