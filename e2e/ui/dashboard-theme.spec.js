import { chromium, expect, test } from '@playwright/test';

test('renders dashboard surfaces and status colors in both themes on mobile and desktop', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const loadViteDependency = (name) => {
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
      const reactDom = await loadViteDependency('react-dom_client');
      const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
      const router = await loadViteDependency('react-router');
      const MemoryRouter = router.MemoryRouter ?? router.default?.MemoryRouter;
      if (typeof createRoot !== 'function') {
        throw new Error(`React DOM client exports: ${Object.keys(reactDom).join(', ')}`);
      }
      const { DashboardOverview } = await import('/src/components/dashboard/DashboardOverview.tsx');
      const ready = {
        isPending: false,
        isError: false,
        isFetching: false,
        error: null,
        onRetry: () => {},
      };
      const failed = {
        ...ready,
        isError: true,
        error: new Error('Practice history is unavailable'),
      };
      const summary = {
        metrics: {
          completedSessions: 3,
          questionsAnswered: 14,
          averageScore: 7.5,
          problemsSolved: 2,
          currentStreak: 2,
        },
        week: [],
        recentSessions: [],
        scoreTrend: [],
        suggestions: [],
        setupChecklist: [],
      };
      const preview = globalThis.document.createElement('div');
      preview.id = 'dashboard-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const content = globalThis.document.createElement('div');
      content.className = 'px-4 py-6 sm:px-6 lg:px-8';
      preview.append(content);
      createRoot(content).render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/dashboard'] },
          createElement(DashboardOverview, {
            name: 'Asha',
            summary,
            theoryStatus: failed,
            codingStatus: ready,
            scoreTrendStatus: ready,
            weakAreasStatus: ready,
            practiceTopicsStatus: ready,
            settingsStatus: ready,
            onOpenSession: () => {},
          })
        )
      );
    });

    const metricLabel = page.getByText('Sessions Completed', { exact: true });
    await expect(metricLabel).toBeVisible();
    const card = metricLabel.locator('..');
    await expect
      .poll(() => card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() =>
        page
          .getByText('Practice history is unavailable', { exact: true })
          .first()
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(253, 164, 175)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() => card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        page
          .getByText('Practice history is unavailable', { exact: true })
          .first()
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(190, 18, 60)');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.locator('#dashboard-preview').evaluate((element) => element.scrollWidth))
      .toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect
      .poll(() => page.locator('#dashboard-preview').evaluate((element) => element.scrollWidth))
      .toBeLessThanOrEqual(1440);
  } finally {
    await browser.close();
  }
});
