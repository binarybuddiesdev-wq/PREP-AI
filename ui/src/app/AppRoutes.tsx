import { Navigate, Route, Routes } from 'react-router';
import { ROUTES } from '@/core';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SignInPage } from '@/pages/SignInPage';
import { SignUpPage } from '@/pages/SignUpPage';
import { ProtectedRoute, PublicRoute } from './RouteGuards';

export const AppRoutes = () => (
  <Routes>
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
      path={ROUTES.dashboard}
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path={ROUTES.settings}
      element={
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to={ROUTES.signIn} replace />} />
  </Routes>
);
