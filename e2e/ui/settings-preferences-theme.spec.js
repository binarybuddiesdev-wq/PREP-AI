import { chromium, expect, test } from '@playwright/test';

test('renders practice preference controls with readable surfaces in both themes', async () => {
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
      const { SettingsFormCard } = await import('/src/components/settings/SettingsFormCard.tsx');
      const preview = globalThis.document.createElement('main');
      preview.id = 'settings-preferences-preview';
      preview.className = 'app-shell';
      preview.dataset.theme = 'dark';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const panel = globalThis.document.createElement('section');
      panel.className = 'app-shell-panel';
      preview.append(panel);
      const values = {
        targetRole: 'Backend Engineer',
        experienceLevel: 'Senior',
        targetCompanies: '',
        preferredTopics: ['React'],
        defaultDifficulty: 'Mid',
        dailyReminder: false,
        dailyReminderTime: '19:00',
        timezone: 'Asia/Kolkata',
      };
      createRoot(panel).render(
        createElement(SettingsFormCard, {
          values,
          userName: 'Asha Rao',
          userEmail: 'asha@example.com',
          isSaving: false,
          status: null,
          activeTab: 'preferences',
          onChange: () => {},
          onSave: () => {},
          onOpenDocuments: () => {},
        })
      );
    });

    const unselectedTopic = page.getByRole('button', { name: 'Node.js' });
    await expect(unselectedTopic).toBeVisible();
    const darkSurface = await unselectedTopic.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    );
    const darkBorder = await unselectedTopic.evaluate(
      (element) => globalThis.getComputedStyle(element).borderColor
    );
    const tabHeaderBorder = await page
      .locator('#settings-preferences-preview header')
      .evaluate((element) => globalThis.getComputedStyle(element).borderBottomColor);
    const saveFooterBorder = await page
      .locator('#settings-preferences-preview footer')
      .evaluate((element) => globalThis.getComputedStyle(element).borderTopColor);

    await page.locator('#settings-preferences-preview').evaluate((element) => {
      element.dataset.theme = 'light';
      element.ownerDocument.documentElement.dataset.theme = 'light';
    });
    await expect
      .poll(() =>
        unselectedTopic.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .not.toBe(darkSurface);
    await expect
      .poll(() =>
        unselectedTopic.evaluate((element) => globalThis.getComputedStyle(element).borderColor)
      )
      .not.toBe(darkBorder);
    await expect
      .poll(() =>
        page
          .locator('#settings-preferences-preview header')
          .evaluate((element) => globalThis.getComputedStyle(element).borderBottomColor)
      )
      .not.toBe(tabHeaderBorder);
    await expect
      .poll(() =>
        page
          .locator('#settings-preferences-preview footer')
          .evaluate((element) => globalThis.getComputedStyle(element).borderTopColor)
      )
      .not.toBe(saveFooterBorder);
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.locator('#settings-preferences-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
