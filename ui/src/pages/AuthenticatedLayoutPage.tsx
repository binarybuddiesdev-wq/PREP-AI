import {
  Code2,
  History,
  LayoutDashboard,
  LibraryBig,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { matchRoutes, Outlet, useLocation, useNavigate } from 'react-router';

import { AppShell, BrandLink, type IAppShellNavigationGroup } from '@/components/layout';
import { ROUTES, type AppShellRoute } from '@/core';
import { useSessionReader, useThemePreference } from '@/logic';
import { UserMenu } from '@/service/auth';

const NAVIGATION: IAppShellNavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', route: ROUTES.dashboard, icon: <LayoutDashboard size={18} /> },
      { label: 'Practice', route: ROUTES.practice, icon: <Zap size={18} /> },
      { label: 'Coding', route: null, icon: <Code2 size={18} /> },
    ],
  },
  {
    label: 'Track',
    items: [
      { label: 'History', route: ROUTES.history, icon: <History size={18} /> },
      { label: 'Settings', route: ROUTES.settings, icon: <Settings2 size={18} /> },
      { label: 'Library', route: ROUTES.library, icon: <LibraryBig size={18} /> },
    ],
  },
];

export const AuthenticatedLayoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useSessionReader();
  const { theme, toggleTheme } = useThemePreference();
  const activeRoute: AppShellRoute = matchRoutes(
    [{ path: ROUTES.historySessionDetail }, { path: ROUTES.history }],
    location
  )
    ? ROUTES.history
    : matchRoutes([{ path: ROUTES.settings }, { path: ROUTES.settingsDocuments }], location)
      ? ROUTES.settings
      : matchRoutes([{ path: ROUTES.library }], location)
        ? ROUTES.library
        : matchRoutes([{ path: ROUTES.practice }], location)
          ? ROUTES.practice
          : ROUTES.dashboard;
  const pageTitle =
    activeRoute === ROUTES.history
      ? 'History'
      : activeRoute === ROUTES.settings
        ? 'Settings'
        : activeRoute === ROUTES.practice
          ? 'Practice'
          : activeRoute === ROUTES.library
            ? 'Library'
            : 'Dashboard';
  const userName = user?.firstName ?? user?.email ?? 'Account';

  return (
    <AppShell
      activeRoute={activeRoute}
      brand={<BrandLink to={ROUTES.dashboard} size="small" />}
      collapseIcon={<PanelLeftClose size={16} />}
      expandIcon={<PanelLeftOpen size={16} />}
      mobileCloseIcon={<X size={20} />}
      mobileMenuIcon={<Menu size={20} />}
      navigation={NAVIGATION}
      onNavigate={(route) => navigate(route)}
      onThemeToggle={toggleTheme}
      pageTitle={pageTitle}
      theme={theme}
      themeIcon={theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      userEmail={user?.email ?? ''}
      userMenu={<UserMenu />}
      userName={userName}
    >
      <Outlet />
    </AppShell>
  );
};
