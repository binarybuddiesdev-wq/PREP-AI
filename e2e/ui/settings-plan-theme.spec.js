import { chromium, expect, test } from '@playwright/test';

test('renders plan, usage, and billing colors in both themes without mobile overflow', async () => {
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
      const { SettingsPlanPanel } = await import('/src/components/settings/SettingsPlanPanel.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'settings-plan-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const content = globalThis.document.createElement('div');
      content.className = 'px-4 py-6 sm:px-6 lg:px-8';
      preview.append(content);
      createRoot(content).render(
        createElement(SettingsPlanPanel, {
          role: 'USER',
          usage: {
            theoryStats: { dailySessions: { used: 2, limit: 3 }, questionsPerSession: 10 },
            codingStats: {
              solved: 8,
              dailySolved: { used: 2, limit: 5 },
              dailyReviews: { used: 1, limit: 3 },
              streakDays: 4,
            },
            isLoading: false,
            errorMessage: null,
            onRetry: () => {},
          },
          billing: {
            subscription: null,
            errorMessage: 'Subscription details are unavailable.',
            createErrorMessage: null,
            createdSubscription: null,
            isLoading: false,
            isCreating: false,
            cancelErrorMessage: null,
            isCancelling: false,
            onRetry: () => {},
            onCreateCheckout: () => {},
            onCancelSubscription: () => {},
          },
        })
      );
    });

    const currentPlan = page.getByRole('region', { name: 'Current plan' });
    await expect(currentPlan).toBeVisible();
    await expect
      .poll(() =>
        currentPlan.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgba(255, 255, 255, 0.04)');
    await expect
      .poll(() =>
        page
          .getByText('Subscription details are unavailable.', { exact: true })
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(253, 164, 175)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        currentPlan.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgba(0, 0, 0, 0.04)');
    await expect
      .poll(() =>
        page
          .getByText('Subscription details are unavailable.', { exact: true })
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(190, 18, 60)');
    await expect
      .poll(() =>
        page
          .getByRole('button', { name: /Monthly/ })
          .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        page
          .getByText('Practice Sessions')
          .locator('xpath=..')
          .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(248, 249, 250)');

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.locator('#settings-plan-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
