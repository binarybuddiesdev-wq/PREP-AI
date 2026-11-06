import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const box = (locator) =>
  locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });

test('matches the reference shell and preserves its responsive interactions', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const dependency = (name) =>
      globalThis.performance
        .getEntriesByType('resource')
        .find((entry) =>
          new globalThis.URL(entry.name).pathname.endsWith(`/node_modules/.vite/deps/${name}.js`)
        );
    const reactModule = await import(dependency('react').name);
    const react = reactModule.default ?? reactModule;
    const domModule = await import(dependency('react-dom_client').name);
    const createRoot = domModule.createRoot ?? domModule.default.createRoot;
    const routerModule = await import(dependency('react-router').name);
    const MemoryRouter = routerModule.MemoryRouter ?? routerModule.default.MemoryRouter;
    const { AppShell } = await import('/src/components/layout/AppShell.tsx');
    const { BrandLink } = await import('/src/components/layout/BrandLink.tsx');
    const { GlobalSearch } = await import('/src/components/search/GlobalSearch.tsx');
    const { NotificationPopover } =
      await import('/src/components/notifications/NotificationPopover.tsx');
    const icons = await import('/node_modules/.vite/deps/lucide-react.js');
    const el = react.createElement;
    const host = globalThis.document.createElement('div');
    host.id = 'shell-reference-preview';
    globalThis.document.querySelector('#root').hidden = true;
    globalThis.document.body.append(host);
    const root = createRoot(host);
    const noop = () => {};
    const Fixture = () => {
      const [theme, setTheme] = react.useState('dark');
      const [searchOpen, setSearchOpen] = react.useState(false);
      const [notificationsOpen, setNotificationsOpen] = react.useState(false);
      return el(
        MemoryRouter,
        null,
        el(AppShell, {
          activeRoute: '/dashboard',
          brand: el(BrandLink, { to: '/dashboard', size: 'small' }),
          collapseIcon: el(icons.PanelLeftClose, { size: 16 }),
          expandIcon: el(icons.PanelLeftOpen, { size: 16 }),
          headerLeadingActions: el(GlobalSearch, {
            isOpen: searchOpen,
            query: '',
            results: [],
            isLoading: false,
            errorMessage: null,
            theme,
            onOpenChange: setSearchOpen,
            onQueryChange: noop,
            onRetry: noop,
            onSelect: noop,
          }),
          headerActions: el(NotificationPopover, {
            isOpen: notificationsOpen,
            notifications: [],
            unreadCount: 3,
            unreadCountError: null,
            errorMessage: null,
            actionErrorMessage: null,
            hasLoaded: true,
            isLoading: false,
            isLoadingMore: false,
            hasMore: false,
            pendingNotificationId: null,
            isMarkingAllRead: false,
            theme,
            onOpenChange: setNotificationsOpen,
            onRetry: noop,
            onRetryUnreadCount: noop,
            onMarkRead: noop,
            onMarkAllRead: noop,
            onDelete: noop,
            onOpenNotification: noop,
            onLoadMore: noop,
          }),
          mobileCloseIcon: el(icons.X, { size: 20 }),
          mobileMenuIcon: el(icons.Menu, { size: 20 }),
          navigation: [
            {
              label: 'Main',
              items: [
                {
                  label: 'Dashboard',
                  route: '/dashboard',
                  icon: el(icons.LayoutDashboard, { size: 18 }),
                },
                { label: 'Practice', route: '/practice', icon: el(icons.Zap, { size: 18 }) },
                { label: 'Coding', route: '/coding', icon: el(icons.Code2, { size: 18 }) },
              ],
            },
            {
              label: 'Track',
              items: [
                { label: 'History', route: '/history', icon: el(icons.History, { size: 18 }) },
                { label: 'Settings', route: '/settings', icon: el(icons.Settings2, { size: 18 }) },
                { label: 'Library', route: '/library', icon: el(icons.LibraryBig, { size: 18 }) },
              ],
            },
          ],
          onNavigate: noop,
          onThemeToggle: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
          pageTitle: 'Dashboard',
          theme,
          themeIcon: el(icons.Sun, { size: 17 }),
          userEmail: 'abhi@example.com',
          userMenu: el(
            'button',
            {
              type: 'button',
              'aria-label': 'Account menu',
              className: 'size-9 rounded-lg border border-white/10',
            },
            'A'
          ),
          userName: 'Abhi',
          children: el('main', null, 'Dashboard content'),
        })
      );
    };
    root.render(el(Fixture));
  });
  const reference = await page.context().newPage();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await reference.setViewportSize(viewport);
    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href, {
      waitUntil: 'networkidle',
    });
    await reference.locator('#scr-app').evaluate((element) => {
      element.hidden = false;
    });
    const sidebar = page.locator('#primary-navigation');
    const toolbar = page.locator('#shell-reference-preview header');

    if (viewport.width > 768) {
      const targetSidebar = await box(reference.locator('.sb'));
      const actualSidebar = await box(sidebar);
      const targetToolbar = await box(reference.locator('.tb'));
      const actualToolbar = await box(toolbar);
      expect(Math.abs(actualSidebar.width - targetSidebar.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(actualToolbar.height - targetToolbar.height)).toBeLessThanOrEqual(4);
      for (const [actual, target] of [
        [
          page.getByRole('button', { name: 'Search pages and topics' }),
          reference.locator('#search-icon'),
        ],
        [
          page.getByRole('button', { name: /Notifications/ }),
          reference.locator('.tb-right > .tb-icon[title="Notifications"]'),
        ],
      ]) {
        const actualControl = await box(actual);
        const referenceControl = await box(target);
        expect(Math.abs(actualControl.width - referenceControl.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(actualControl.height - referenceControl.height)).toBeLessThanOrEqual(1);
      }
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(sidebar).toHaveCSS('width', '60px');
      await expect(page.locator('.app-shell > div > div')).toHaveCSS('padding-left', '60px');
      await page.getByRole('button', { name: 'Expand sidebar' }).click();
      await page.getByRole('button', { name: 'Switch to light theme' }).click();
      await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', 'light');
      await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    } else {
      expect(sidebar).toHaveAttribute('data-mobile-open', 'false');
      expect((await box(sidebar)).x).toBeLessThanOrEqual(-239);
      const targetToolbar = await box(reference.locator('.tb'));
      const actualToolbar = await box(toolbar);
      expect(Math.abs(actualToolbar.height - targetToolbar.height)).toBeLessThanOrEqual(4);
      await reference.locator('.hamburger').click();
      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      await expect(sidebar).toBeVisible();
      const targetSidebar = await box(reference.locator('.sb'));
      const actualSidebar = await box(sidebar);
      expect(Math.abs(actualSidebar.width - targetSidebar.width)).toBeLessThanOrEqual(2);
      await page.keyboard.press('Escape');
      await reference.keyboard.press('Escape');
      await expect(sidebar).toHaveAttribute('data-mobile-open', 'false');
      expect((await box(sidebar)).x).toBeLessThanOrEqual(-239);
      await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
    }
  }
  await reference.close();
});
