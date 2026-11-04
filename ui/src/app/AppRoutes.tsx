import { Navigate, Route, Routes } from 'react-router';
import { ROUTES } from '@/core';
import {
  AuthenticatedLayoutPage,
  DashboardPage,
  LandingPage,
  OnboardingPage,
  SettingsPage,
  SignInPage,
  SignUpPage,
} from '@/pages';
import { ProtectedRoute, PublicRoute } from './RouteGuards';

export const AppRoutes = () => (
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
      <Route path={ROUTES.settings} element={<SettingsPage />} />
    </Route>
    <Route
      path={ROUTES.onboarding}
      element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to={ROUTES.signIn} replace />} />
  </Routes>
);
