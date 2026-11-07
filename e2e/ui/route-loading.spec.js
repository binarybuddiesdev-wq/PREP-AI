import { expect, test } from '@playwright/test';

test('loads the current route module without eagerly loading signed-in screens', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { name: /the smarter way to.*prepare for interviews/i })
  ).toBeVisible();

  const loadedPageModules = await page.evaluate(() =>
    globalThis.performance
      .getEntriesByType('resource')
      .map((resource) => new globalThis.URL(resource.name).pathname)
      .filter((pathname) => pathname.startsWith('/src/pages/'))
  );

  expect(loadedPageModules).toContain('/src/pages/LandingPage.tsx');
  expect(loadedPageModules).not.toContain('/src/pages/DashboardPage.tsx');
  expect(loadedPageModules).not.toContain('/src/pages/CodingProblemPage.tsx');

  await page.getByRole('link', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole('main', { name: 'Account access' })).toBeVisible();
});

test('replaces Library with route loading UI during sidebar navigation', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    const loadViteDependency = async (name) => {
      const resource = globalThis.performance
        .getEntriesByType('resource')
        .find((entry) =>
          new globalThis.URL(entry.name).pathname.endsWith(`/node_modules/.vite/deps/${name}.js`)
        );
      if (!resource) throw new Error(`Vite dependency was not loaded: ${name}`);
      return import(resource.name);
    };
    const react = await loadViteDependency('react');
    const createElement = react.createElement ?? react.default?.createElement;
    const Suspense = react.Suspense ?? react.default?.Suspense;
    const reactDom = await loadViteDependency('react-dom_client');
    const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
    const router = await loadViteDependency('react-router');
    const BrowserRouter = router.BrowserRouter ?? router.default?.BrowserRouter;
    const Route = router.Route ?? router.default?.Route;
    const Routes = router.Routes ?? router.default?.Routes;
    const Outlet = router.Outlet ?? router.default?.Outlet;
    const useLocation = router.useLocation ?? router.default?.useLocation;
    const useNavigate = router.useNavigate ?? router.default?.useNavigate;
    const { AppShell } = await import('/src/components/layout/AppShell.tsx');

    let resolvePending;
    const pending = new Promise((resolve) => {
      resolvePending = resolve;
    });
    const routeState = { isPending: true, resolve: resolvePending, pending };
    globalThis.window.__prepaiRouteState = routeState;
    globalThis.history.replaceState(null, '', '/library');
    globalThis.document.querySelector('#root').hidden = true;
    const preview = globalThis.document.createElement('div');
    preview.id = 'route-transition-preview';
    globalThis.document.body.append(preview);

    const NavigationLayout = () => {
      const location = useLocation();
      const navigate = useNavigate();
      const activeRoute = location.pathname === '/library' ? '/library' : '/practice';
      const pageTitle = activeRoute === '/library' ? 'Library' : 'Practice';
      return createElement(AppShell, {
        activeRoute,
        brand: createElement('span', null, 'PrepAI'),
        children: createElement(
          Suspense,
          { fallback: createElement('div', { role: 'status' }, 'Loading destination...') },
          createElement(Outlet)
        ),
        collapseIcon: null,
        expandIcon: null,
        mobileCloseIcon: null,
        mobileMenuIcon: null,
        navigation: [
          {
            label: 'Track',
            items: [
              { label: 'Practice', route: '/practice', icon: null },
              { label: 'Library', route: '/library', icon: null },
            ],
          },
        ],
        onNavigate: (path) => navigate(path),
        onThemeToggle: () => {},
        pageTitle,
        theme: 'dark',
        themeIcon: null,
        userEmail: 'asha@example.com',
        userMenu: null,
        userName: 'Asha',
      });
    };

    const DelayedPracticePage = () => {
      if (routeState.isPending) throw routeState.pending;
      return createElement('h1', null, 'Practice destination loaded');
    };

    createRoot(preview).render(
      createElement(
        BrowserRouter,
        { useTransitions: false },
        createElement(
          Suspense,
          { fallback: createElement('div', { role: 'status' }, 'Loading destination...') },
          createElement(
            Routes,
            null,
            createElement(
              Route,
              { element: createElement(NavigationLayout) },
              createElement(Route, {
                path: '/library',
                element: createElement('h1', null, 'Library screen'),
              }),
              createElement(Route, {
                path: '/practice',
                element: createElement(DelayedPracticePage),
              })
            )
          )
        )
      )
    );
  });

  const preview = page.locator('#route-transition-preview');
  await expect(preview.getByRole('heading', { name: 'Library screen' })).toBeVisible();
  await preview.getByRole('link', { name: 'Practice' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(preview.getByText('Loading destination...')).toBeVisible();
  await expect(preview.getByRole('complementary', { name: 'Primary navigation' })).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Library screen' })).toHaveCount(0);

  await page.evaluate(() => {
    const state = globalThis.window.__prepaiRouteState;
    state.isPending = false;
    state.resolve();
  });
  await expect(preview.getByRole('heading', { name: 'Practice destination loaded' })).toBeVisible();
});
