import { chromium, expect, test } from '@playwright/test';

test('renders coding catalog and statistics in both themes without mobile overflow', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

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
      if (typeof createRoot !== 'function') {
        throw new Error(`React DOM client exports: ${Object.keys(reactDom).join(', ')}`);
      }

      const { CodingProblemCatalog } =
        await import('/src/components/coding/CodingProblemCatalog.tsx');
      const { CodingStatsBar } = await import('/src/components/coding/CodingStatsBar.tsx');
      const preview = globalThis.document.createElement('main');
      preview.id = 'coding-catalog-preview';
      preview.className = 'mx-auto w-full max-w-6xl space-y-5 p-4';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);

      const problems = [
        {
          id: 'two-sum',
          title: 'Two Sum',
          slug: 'two-sum',
          description: 'Find two numbers that add up to the target.',
          difficulty: 'Easy',
          topic: 'Arrays',
          isSolved: true,
        },
      ];
      createRoot(preview).render(
        createElement(
          react.default?.Fragment ?? react.Fragment,
          null,
          createElement(CodingStatsBar, {
            stats: {
              solved: 7,
              dailySolved: { used: 2, limit: 5 },
              dailyReviews: { used: 1, limit: 3 },
              streakDays: 4,
            },
            isLoading: false,
            isRetrying: false,
            errorMessage: 'Coding stats could not be loaded: Stats service unavailable',
            onRetry: () => {},
          }),
          createElement(CodingProblemCatalog, {
            problems,
            selectedTopic: null,
            selectedDifficulty: null,
            onSelectTopic: () => {},
            onSelectDifficulty: () => {},
            onSelectProblem: () => {},
          })
        )
      );
    });

    const preview = page.locator('#coding-catalog-preview');
    const problem = page.getByRole('button', { name: /Two Sum/ });
    const metric = page.getByRole('group', { name: 'Coding statistics' }).locator('div').first();
    const error = page.getByRole('alert');
    await expect(problem).toBeVisible();
    await expect(error).toContainText('Stats service unavailable');
    await expect
      .poll(() =>
        metric.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() =>
        problem.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        metric.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        problem.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() => preview.evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
