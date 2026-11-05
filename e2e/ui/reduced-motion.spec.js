import { chromium, expect, test } from '@playwright/test';

test('uses semantic app navigation and honors reduced-motion preferences', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
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
      const { AppShell } = await import('/src/components/layout/AppShell.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'reduced-motion-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      createRoot(preview).render(
        createElement(AppShell, {
          activeRoute: '/dashboard',
          brand: createElement('span', null, 'PrepAI'),
          children: createElement('main', null, 'Dashboard content'),
          collapseIcon: null,
          expandIcon: null,
          mobileCloseIcon: null,
          mobileMenuIcon: null,
          navigation: [
            { label: 'Main', items: [{ label: 'Dashboard', route: '/dashboard', icon: null }] },
          ],
          onNavigate: () => {},
          onThemeToggle: () => {},
          pageTitle: 'Dashboard',
          theme: 'dark',
          themeIcon: null,
          userEmail: 'user@example.com',
          userMenu: createElement('button', { type: 'button' }, 'Account'),
          userName: 'User',
        })
      );
    });

    const sidebar = page.locator('#reduced-motion-preview .app-shell aside');
    await expect(sidebar).toHaveCount(1);
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await page
      .locator('#reduced-motion-preview .app-shell')
      .evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        dashboardLink.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(254, 243, 199)');
    await expect
      .poll(() =>
        sidebar.evaluate((element) =>
          Math.max(
            ...globalThis
              .getComputedStyle(element)
              .transitionDuration.split(',')
              .map((duration) => Number.parseFloat(duration))
          )
        )
      )
      .toBeLessThan(0.001);
  } finally {
    await browser.close();
  }
});
