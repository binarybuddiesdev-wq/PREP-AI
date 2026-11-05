import { chromium, expect, test } from '@playwright/test';

test('renders branded authentication surfaces in both themes', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    const appearanceTokens = await page.evaluate(async () => {
      const { authAppearance } = await import('/src/service/auth/authAppearance.ts');
      return authAppearance.variables;
    });
    expect(appearanceTokens.colorForeground).toBe('var(--text)');
    expect(appearanceTokens.colorBackground).toBe('var(--card)');
    expect(appearanceTokens.colorInput).toBe('var(--bg2)');

    await page.evaluate(async () => {
      globalThis.document.documentElement.dataset.theme = 'dark';
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
      const { AuthPageShell } = await import('/src/components/auth/AuthPageShell.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'auth-theme-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      createRoot(preview).render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            AuthPageShell,
            { brandTo: '/' },
            createElement(
              'form',
              null,
              createElement('label', { htmlFor: 'auth-email' }, 'Email address'),
              createElement('input', { id: 'auth-email', type: 'email' }),
              createElement('button', { type: 'submit' }, 'Continue')
            )
          )
        )
      );
    });

    const shell = page.getByRole('main', { name: 'Account access' });
    const card = page.getByRole('region', { name: 'PrepAI authentication' });
    const brand = page.getByRole('link', { name: 'PrepAI' });
    await expect(shell).toBeVisible();
    await expect(card).toBeVisible();
    await expect(brand).toHaveCSS('color', 'rgb(250, 250, 250)');
    await expect(shell).toHaveCSS('background-color', 'rgb(9, 9, 11)');
    await expect(card).toHaveCSS('background-color', 'rgb(24, 24, 27)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect(shell).toHaveCSS('background-color', 'rgb(248, 249, 250)');
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(brand).toHaveCSS('color', 'rgb(17, 24, 39)');
    await expect
      .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await expect
      .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollHeight))
      .toBeLessThanOrEqual(844);
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
