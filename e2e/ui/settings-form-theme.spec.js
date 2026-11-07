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
    const preview = page.locator('#settings-form-theme-preview');
    const companyInput = preview.getByRole('textbox', { name: 'Target companies' });
    const firstNameInput = preview.getByRole('textbox', { name: 'First Name' });
    await expect(formCard).toBeVisible();
    await expect(companyInput).toHaveValue('Acme, Example Co.');

    const readStyles = async () => ({
      ...(await formCard.evaluate((element) => ({
        cardBackground: globalThis.getComputedStyle(element).backgroundColor,
        cardBorder: globalThis.getComputedStyle(element).borderColor,
      }))),
      ...(await companyInput.evaluate((element) => ({
        inputBackground: globalThis.getComputedStyle(element).backgroundColor,
        inputText: globalThis.getComputedStyle(element).color,
      }))),
      ...(await preview.evaluate((container) => ({
        selectedTabText: globalThis.getComputedStyle(
          container.querySelector('[role="tab"][aria-selected="true"]')
        ).color,
        statusText: globalThis.getComputedStyle(container.querySelector('[role="status"]')).color,
      }))),
      identityText: await firstNameInput.evaluate(
        (element) => globalThis.getComputedStyle(element).color
      ),
    });
    const darkStyles = await readStyles();

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await page
      .locator('#settings-form-theme-preview')
      .evaluate((element) => (element.dataset.theme = 'light'));
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

    await preview.getByRole('tab', { name: 'Notifications' }).click();
    const reminderSwitch = preview.getByRole('switch', { name: 'Daily Practice Reminder' });
    const reminderTime = preview.getByLabel('Reminder time');
    await expect(reminderSwitch).toBeVisible();
    await expect(reminderTime).toHaveValue('19:00');
    const reminderSwitchBackground = await reminderSwitch.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    );
    await preview.getByRole('tab', { name: 'Practice Preferences' }).click();
    await expect(preview.getByText('Preferred Topics')).toBeVisible();
    await expect(preview.getByRole('button', { name: 'React' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(reminderSwitchBackground).not.toBe('transparent');

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
