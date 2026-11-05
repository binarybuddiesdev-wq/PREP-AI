import type { ReactNode } from 'react';

import type { AppShellRoute, Theme } from '@/core';

export interface IAppShellNavigationItem {
  label: string;
  route: AppShellRoute | null;
  icon: ReactNode;
}

export interface IAppShellNavigationGroup {
  label: string;
  items: IAppShellNavigationItem[];
}

export interface IAppShellProps {
  activeRoute: AppShellRoute;
  brand: ReactNode;
  children: ReactNode;
  collapseIcon: ReactNode;
  expandIcon: ReactNode;
  headerActions?: ReactNode;
  mobileCloseIcon: ReactNode;
  mobileMenuIcon: ReactNode;
  navigation: IAppShellNavigationGroup[];
  onNavigate: (route: AppShellRoute) => void;
  onThemeToggle: () => void;
  pageTitle: string;
  theme: Theme;
  themeIcon: ReactNode;
  userEmail: string;
  userMenu: ReactNode;
  userName: string;
}
