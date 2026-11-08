import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { ROUTES } from '@/core';
import { LoadingScreen } from '@/components/layout';
import { ProtectedRoute, PublicRoute } from './RouteGuards';

const AuthenticatedLayoutPage = lazy(() =>
  import('@/pages/AuthenticatedLayoutPage').then((module) => ({
    default: module.AuthenticatedLayoutPage,
  }))
);
const CodingPage = lazy(() =>
  import('@/pages/CodingPage').then((module) => ({ default: module.CodingPage }))
);
const CodingProblemPage = lazy(() =>
  import('@/pages/CodingProblemPage').then((module) => ({ default: module.CodingProblemPage }))
);
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage }))
);
const LandingPage = lazy(() =>
  import('@/pages/LandingPage').then((module) => ({ default: module.LandingPage }))
);
const LibraryPage = lazy(() =>
  import('@/pages/LibraryPage').then((module) => ({ default: module.LibraryPage }))
);
const OnboardingPage = lazy(() =>
  import('@/pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage }))
);
const PracticePage = lazy(() =>
  import('@/pages/PracticePage').then((module) => ({ default: module.PracticePage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage }))
);
const SettingsDocumentsPage = lazy(() =>
  import('@/pages/SettingsDocumentsPage').then((module) => ({
    default: module.SettingsDocumentsPage,
  }))
);
const SessionHistoryPage = lazy(() =>
  import('@/pages/SessionHistoryPage').then((module) => ({ default: module.SessionHistoryPage }))
);
const SignInPage = lazy(() =>
  import('@/pages/SignInPage').then((module) => ({ default: module.SignInPage }))
);
const SignUpPage = lazy(() =>
  import('@/pages/SignUpPage').then((module) => ({ default: module.SignUpPage }))
);
const TheorySessionDetailPage = lazy(() =>
  import('@/pages/TheorySessionDetailPage').then((module) => ({
    default: module.TheorySessionDetailPage,
  }))
);
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage }))
);

export const AppRoutes = () => (
  <Suspense fallback={<LoadingScreen label="Loading PrepAI..." />}>
    <Routes>
      <Route
        path={ROUTES.root}
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route
        path={`${ROUTES.signIn}/*`}
        element={
          <PublicRoute>
            <SignInPage />
          </PublicRoute>
        }
      />
      <Route
        path={`${ROUTES.signUp}/*`}
        element={
          <PublicRoute>
            <SignUpPage />
          </PublicRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AuthenticatedLayoutPage />
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.dashboard} element={<DashboardPage />} />
        <Route path={ROUTES.coding} element={<CodingPage />} />
        <Route path={ROUTES.codingProblem} element={<CodingProblemPage />} />
        <Route path={ROUTES.practice} element={<PracticePage />} />
        <Route path={ROUTES.history} element={<SessionHistoryPage />} />
        <Route path={ROUTES.historySessionDetail} element={<TheorySessionDetailPage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path={ROUTES.settingsDocuments} element={<SettingsDocumentsPage />} />
        <Route path={ROUTES.library} element={<LibraryPage />} />
      </Route>
      <Route
        path={ROUTES.onboarding}
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);
