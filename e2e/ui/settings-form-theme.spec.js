import { chromium, expect, test } from '@playwright/test';

test('renders editable Settings tabs with readable theme-aware controls', async () => {
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
      const router = await loadViteDependency('react-router');
      const { SettingsFormCard } = await import('/src/components/settings/SettingsFormCard.tsx');
      const preview = globalThis.document.createElement('main');
      preview.id = 'settings-form-theme-preview';
      preview.className = 'app-shell';
      preview.dataset.theme = 'dark';
      globalThis.document.documentElement.dataset.theme = 'dark';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const values = {
        targetRole: 'Backend Engineer',
        experienceLevel: 'Senior',
        targetCompanies: 'Acme, Example Co.',
        preferredTopics: ['React'],
        defaultDifficulty: 'Mid',
        dailyReminder: false,
        dailyReminderTime: '19:00',
        timezone: 'Asia/Kolkata',
      };
      createRoot(preview).render(
        createElement(
          router.MemoryRouter,
          null,
          createElement(SettingsFormCard, {
            values,
            userName: 'Asha Rao',
            userEmail: 'asha@example.com',
            isSaving: false,
            status: { kind: 'success', message: 'Settings saved successfully' },
            onChange: () => {},
            onSave: () => {},
            onOpenDocuments: () => {},
          })
        )
      );
    });

    const formCard = page.locator('#settings-form-theme-preview .app-shell-panel');
    const companyInput = page.getByRole('textbox', { name: 'Target companies' });
    await expect(formCard).toBeVisible();
    await expect(companyInput).toHaveValue('Acme, Example Co.');

    const readStyles = async () => ({
      cardBackground: await formCard.evaluate(
        (element) => globalThis.getComputedStyle(element).backgroundColor
      ),
      cardBorder: await formCard.evaluate(
        (element) => globalThis.getComputedStyle(element).borderColor
      ),
      inputBackground: await companyInput.evaluate(
        (element) => globalThis.getComputedStyle(element).backgroundColor
      ),
      inputText: await companyInput.evaluate(
        (element) => globalThis.getComputedStyle(element).color
      ),
      selectedTabText: await page
        .locator('#settings-form-theme-preview [role="tab"][aria-selected="true"]')
        .evaluate((element) => globalThis.getComputedStyle(element).color),
      identityText: await page
        .locator('#settings-form-theme-preview')
        .getByText('Asha Rao')
        .evaluate((element) => globalThis.getComputedStyle(element).color),
      statusText: await page
        .locator('#settings-form-theme-preview [role="status"]')
        .evaluate((element) => globalThis.getComputedStyle(element).color),
    });
    const darkStyles = await readStyles();

    await page.locator('#root').evaluate((element) => (element.hidden = false));
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
    await page
      .locator('#settings-form-theme-preview')
      .evaluate((element) => (element.dataset.theme = 'light'));
    await page.locator('#root').evaluate((element) => (element.hidden = true));
    await expect
      .poll(async () => {
        const currentStyles = await readStyles();
        return Object.keys(darkStyles).every(
          (property) => currentStyles[property] !== darkStyles[property]
        );
      })
      .toBe(true);
    const lightStyles = await readStyles();
    expect(lightStyles).not.toEqual(darkStyles);
    for (const property of Object.keys(darkStyles)) {
      expect(
        lightStyles[property],
        `${property} should follow the theme: ${JSON.stringify({ darkStyles, lightStyles })}`
      ).not.toBe(darkStyles[property]);
    }

    await page.getByRole('tab', { name: 'Notifications' }).click();
    const reminderCheckbox = page.getByRole('checkbox', { name: 'Daily practice reminder' });
    const reminderTime = page.getByLabel('Reminder time');
    await expect(reminderCheckbox).toBeVisible();
    await expect(reminderTime).toHaveValue('19:00');
    const checkboxAccent = await reminderCheckbox.evaluate(
      (element) => globalThis.getComputedStyle(element).accentColor
    );
    await page.getByRole('tab', { name: 'Practice Preferences' }).click();
    await expect(page.getByRole('heading', { name: 'Focus topics' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'React' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(checkboxAccent).not.toBe('auto');

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.locator('#settings-form-theme-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
