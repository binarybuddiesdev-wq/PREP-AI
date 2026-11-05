import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { cn } from '@/utils';
import './AppShell.css';
import type { IAppShellProps } from './AppShell.types';

export const AppShell = (props: IAppShellProps) => {
  const {
    activeRoute,
    brand,
    children,
    collapseIcon,
    expandIcon,
    headerLeadingActions,
    headerActions,
    sidebarAction,
    mobileCloseIcon,
    mobileMenuIcon,
    navigation,
    onNavigate,
    onThemeToggle,
    pageTitle,
    theme,
    themeIcon,
    userEmail,
    userMenu,
    userName,
  } = props;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const wasMobileNavigationOpen = useRef(false);
  const isDarkTheme = theme === 'dark';

  const closeMobileNavigation = () => setIsMobileNavigationOpen(false);

  useEffect(() => {
    if (isMobileNavigationOpen) {
      asideRef.current
        ?.querySelector<HTMLElement>('[data-mobile-drawer-focusable]:not(:disabled)')
        ?.focus();
    } else if (wasMobileNavigationOpen.current) {
      menuTriggerRef.current?.focus();
    }
    wasMobileNavigationOpen.current = isMobileNavigationOpen;
  }, [isMobileNavigationOpen]);

  const handleMobileNavigationKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileNavigation();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled):not([data-desktop-only])'
      )
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) return;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div data-theme={theme} data-collapsed={isCollapsed} className="app-shell">
      <div
        className={cn(
          'min-h-svh transition-colors',
          isDarkTheme ? 'bg-[#09090b] text-zinc-100' : 'bg-zinc-50 text-zinc-900'
        )}
      >
        {isMobileNavigationOpen && (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={closeMobileNavigation}
          />
        )}

        <aside
          ref={asideRef}
          id="primary-navigation"
          aria-label="Primary navigation"
          data-mobile-open={isMobileNavigationOpen}
          onKeyDown={isMobileNavigationOpen ? handleMobileNavigationKeyDown : undefined}
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r transition-all duration-200 md:translate-x-0',
            isDarkTheme ? 'border-white/[0.08] bg-[#111113]' : 'border-zinc-200 bg-white',
            isCollapsed && 'md:w-[68px]',
            isMobileNavigationOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div
            className={cn(
              'flex min-h-[72px] items-center justify-between gap-3 border-b px-4 py-4',
              isCollapsed && 'md:min-h-24 md:flex-col md:justify-center md:gap-2 md:px-2 md:py-3',
              isDarkTheme ? 'border-white/[0.08]' : 'border-zinc-200'
            )}
          >
            <div
              data-app-shell-brand
              onClick={closeMobileNavigation}
              className={cn('min-w-0 flex-1', isCollapsed && 'md:flex-none md:justify-center')}
            >
              {brand}
            </div>
            <button
              type="button"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              data-desktop-only
              className={cn(
                'hidden size-8 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-amber-400 md:flex',
                isDarkTheme
                  ? 'border-white/10 text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                  : 'border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
              )}
              onClick={() => setIsCollapsed((previous) => !previous)}
            >
              {isCollapsed ? expandIcon : collapseIcon}
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3" aria-label="Sections">
            {navigation.map((group) => (
              <div key={group.label}>
                <p
                  className={cn(
                    cn(
                      'mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em]',
                      isDarkTheme ? 'text-zinc-600' : 'text-zinc-500'
                    ),
                    isCollapsed && 'md:sr-only'
                  )}
                >
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item.route === activeRoute;
                    const isAvailable = item.route !== null;

                    return (
                      <li key={item.label}>
                        <button
                          type="button"
                          data-mobile-drawer-focusable
                          aria-label={!isAvailable ? `${item.label}, coming soon` : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          aria-disabled={!isAvailable}
                          disabled={!isAvailable}
                          title={
                            !isAvailable
                              ? `${item.label} is coming soon`
                              : isCollapsed
                                ? item.label
                                : undefined
                          }
                          className={cn(
                            'group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400',
                            isActive
                              ? 'bg-amber-400/10 text-amber-300'
                              : isDarkTheme
                                ? 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                            !isAvailable && 'cursor-not-allowed opacity-60',
                            isCollapsed && 'md:justify-center md:px-0'
                          )}
                          onClick={() => {
                            if (item.route) {
                              onNavigate(item.route);
                              closeMobileNavigation();
                            }
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="flex size-5 shrink-0 items-center justify-center"
                          >
                            {item.icon}
                          </span>
                          <span
                            className={cn('min-w-0 flex-1 truncate', isCollapsed && 'md:sr-only')}
                          >
                            {item.label}
                          </span>
                          {!isAvailable && (
                            <span
                              className={cn(
                                cn(
                                  'ml-auto rounded-full border px-1.5 py-0.5 text-[0.58rem] font-medium',
                                  isDarkTheme
                                    ? 'border-white/[0.08] text-zinc-500'
                                    : 'border-zinc-200 text-zinc-500'
                                ),
                                isCollapsed && 'md:sr-only'
                              )}
                            >
                              Soon
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {sidebarAction && <div className="px-3 pb-3">{sidebarAction}</div>}

          <div
            className={cn(
              'flex items-center gap-3 border-t px-4 py-3',
              isDarkTheme ? 'border-white/[0.08]' : 'border-zinc-200'
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-sm font-semibold text-amber-300"
            >
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className={cn('min-w-0 flex-1', isCollapsed && 'md:sr-only')}>
              <span
                className={cn(
                  'block truncate text-sm font-medium',
                  isDarkTheme ? 'text-zinc-200' : 'text-zinc-800'
                )}
              >
                {userName}
              </span>
              <span
                className={cn(
                  'block truncate text-xs',
                  isDarkTheme ? 'text-zinc-500' : 'text-zinc-600'
                )}
              >
                {userEmail}
              </span>
            </span>
          </div>
        </aside>

        <div
          className={cn(
            'min-h-svh transition-[padding] duration-200 md:pl-[240px]',
            isCollapsed && 'md:pl-[68px]'
          )}
        >
          <header
            className={cn(
              'sticky top-0 z-20 flex h-[68px] items-center justify-between border-b px-4 backdrop-blur-xl sm:px-6',
              isDarkTheme ? 'border-white/[0.08] bg-[#09090b]/90' : 'border-zinc-200 bg-white/90'
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={menuTriggerRef}
                type="button"
                aria-label={`${isMobileNavigationOpen ? 'Close' : 'Open'} navigation menu`}
                aria-controls="primary-navigation"
                aria-expanded={isMobileNavigationOpen}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-amber-400 md:hidden',
                  isDarkTheme
                    ? 'text-zinc-300 hover:bg-white/[0.06]'
                    : 'text-zinc-600 hover:bg-zinc-100'
                )}
                onClick={() => setIsMobileNavigationOpen((previous) => !previous)}
              >
                {isMobileNavigationOpen ? mobileCloseIcon : mobileMenuIcon}
              </button>
              <span
                className={cn(
                  'truncate text-base font-semibold',
                  isDarkTheme ? 'text-zinc-100' : 'text-zinc-900'
                )}
              >
                {pageTitle}
              </span>
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-2">
              {headerLeadingActions}
              <button
                type="button"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                aria-pressed={theme === 'light'}
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-amber-400',
                  isDarkTheme
                    ? 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
                    : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                )}
                onClick={onThemeToggle}
              >
                {themeIcon}
              </button>
              {headerActions}
              {userMenu}
            </div>
          </header>
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
};
