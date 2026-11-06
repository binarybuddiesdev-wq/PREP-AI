import {
  Code2,
  CreditCard,
  History,
  LayoutDashboard,
  LibraryBig,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { matchRoutes, Outlet, useLocation, useNavigate } from 'react-router';

import { AppShell, BrandLink, type IAppShellNavigationGroup } from '@/components/layout';
import { GlobalSearch } from '@/components/search';
import { ROUTES, type AppShellRoute, type IGlobalSearchResult } from '@/core';
import { useGlobalSearch, useSessionReader, useThemePreference } from '@/logic';
import { UserMenu } from '@/service/auth';
import { StudyChatWidget } from './StudyChatWidget';
import { NotificationCenter } from './NotificationCenter';

const NAVIGATION: IAppShellNavigationGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', route: ROUTES.dashboard, icon: <LayoutDashboard size={18} /> },
      { label: 'Practice', route: ROUTES.practice, icon: <Zap size={18} /> },
      { label: 'Coding', route: ROUTES.coding, icon: <Code2 size={18} /> },
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const search = useGlobalSearch(searchQuery, isSearchOpen);
  const activeRoute: AppShellRoute = matchRoutes(
    [
      { path: ROUTES.historySessionDetail },
      { path: ROUTES.history },
      { path: ROUTES.codingProblem },
      { path: ROUTES.coding },
    ],
    location
  )
    ? location.pathname.toLowerCase().startsWith(ROUTES.coding)
      ? ROUTES.coding
      : ROUTES.history
    : matchRoutes([{ path: ROUTES.settings }, { path: ROUTES.settingsDocuments }], location)
      ? ROUTES.settings
      : matchRoutes([{ path: ROUTES.library }], location)
        ? ROUTES.library
        : matchRoutes([{ path: ROUTES.practice }], location)
          ? ROUTES.practice
          : ROUTES.dashboard;
  const pageTitle =
    activeRoute === ROUTES.coding
      ? 'Coding'
      : activeRoute === ROUTES.history
        ? 'History'
        : activeRoute === ROUTES.settings
          ? 'Settings'
          : activeRoute === ROUTES.practice
            ? 'Practice'
            : activeRoute === ROUTES.library
              ? 'Library'
              : 'Dashboard';
  const userName = user?.firstName ?? user?.email ?? 'Account';

  const selectSearchResult = (result: IGlobalSearchResult) => {
    if (result.type === 'topic') {
      navigate(`${ROUTES.practice}?topicId=${encodeURIComponent(result.topicId)}`);
      return;
    }
    navigate(result.route);
  };

  return (
    <>
      <AppShell
        activeRoute={activeRoute}
        brand={<BrandLink to={ROUTES.dashboard} size="small" />}
        collapseIcon={<PanelLeftClose size={16} />}
        expandIcon={<PanelLeftOpen size={16} />}
        headerLeadingActions={
          <GlobalSearch
            isOpen={isSearchOpen}
            query={searchQuery}
            results={search.results}
            isLoading={search.isLoading}
            errorMessage={search.errorMessage}
            theme={theme}
            onOpenChange={setIsSearchOpen}
            onQueryChange={setSearchQuery}
            onRetry={() => void search.retry()}
            onSelect={selectSearchResult}
          />
        }
        headerActions={
          <>
            {activeRoute === ROUTES.dashboard && (
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-zinc-950 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                onClick={() => navigate(ROUTES.practice)}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                New Session
              </button>
            )}
            <NotificationCenter theme={theme} />
          </>
        }
        sidebarAction={
          <button
            type="button"
            aria-label="Plan & billing"
            title="Plan & billing"
            className={`app-shell-sidebar-action flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-amber-400 ${theme === 'dark' ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-200 hover:bg-amber-400/10' : 'border-amber-500/25 bg-amber-50 text-amber-900 hover:bg-amber-100'}`}
            onClick={() => navigate(`${ROUTES.settings}?tab=plan`)}
          >
            <CreditCard aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate" data-sidebar-action-label>
              Plan &amp; billing
            </span>
          </button>
        }
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
      <StudyChatWidget theme={theme} />
    </>
  );
};
