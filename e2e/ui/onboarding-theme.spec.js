import { chromium, expect, test } from '@playwright/test';

test('renders onboarding and its select menu with readable colors in both themes', async () => {
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
      const { OnboardingWizard } = await import('/src/components/onboarding/OnboardingWizard.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'onboarding-theme-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const values = {
        targetRole: '',
        experienceLevel: '',
        targetCompanies: 'Example Co',
        preferredTopics: ['React'],
        defaultDifficulty: '',
      };
      createRoot(preview).render(
        createElement(OnboardingWizard, {
          brand: createElement('span', null, 'PrepAI'),
          step: 3,
          values,
          isSaving: false,
          errorMessage: 'Could not save your progress.',
          errorDetails: 'The request timed out.',
          onChange: () => {},
          onContinue: () => {},
          onBack: () => {},
          onSkip: () => {},
          onFinish: () => {},
        })
      );
    });

    const screen = page.getByRole('main', { name: 'Profile setup' });
    const card = page.locator('.onboarding-card');
    const selectedTopic = page.getByRole('button', { name: 'React' });
    const errorText = page.getByText('Could not save your progress.', { exact: true });
    const difficulty = page.getByRole('combobox', { name: 'Default Difficulty' });
    await expect(screen).toBeVisible();
    await expect(card).toBeVisible();
    await expect(errorText).toBeVisible();

    await expect
      .poll(() =>
        screen.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(9, 9, 11)');
    await expect
      .poll(() => card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .toBe('rgb(24, 24, 27)');
    const darkTopic = await selectedTopic.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor
    );
    const placeholder = difficulty.locator('[data-placeholder]');
    await expect(placeholder).toHaveCSS('color', 'rgb(161, 161, 170)');
    await page.evaluate(() => globalThis.document.activeElement?.blur());
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await page.keyboard.press('Tab');
      if (await difficulty.evaluate((element) => element === globalThis.document.activeElement)) {
        break;
      }
    }
    await expect(difficulty).toBeFocused();
    await expect(difficulty).toHaveCSS('outline-color', 'rgb(251, 191, 36)');
    await expect(difficulty).toHaveCSS('outline-width', '2px');
    await page.keyboard.press('Enter');
    await expect(difficulty).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.07)');
    const popup = page.locator('.settings-select-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveCSS('background-color', 'rgb(24, 24, 27)');
    await page.keyboard.press('Escape');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        screen.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(248, 249, 250)');
    await expect
      .poll(() => card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        selectedTopic.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .not.toBe(darkTopic);
    await expect(placeholder).toHaveCSS('color', 'rgb(107, 114, 128)');
    await expect(difficulty).toHaveCSS('outline-color', 'rgb(146, 64, 14)');
    await expect(difficulty).toHaveCSS('outline-width', '2px');
    await expect
      .poll(() => errorText.evaluate((element) => globalThis.getComputedStyle(element).color))
      .toBe('rgb(190, 18, 60)');
    await page.keyboard.press('Enter');
    await expect(difficulty).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.06)');
    await expect(popup).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(popup).toHaveCSS('color', 'rgb(17, 24, 39)');
    await page.keyboard.press('Escape');

    await expect
      .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await expect
      .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollHeight))
      .toBeLessThanOrEqual(844);
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() => page.evaluate(() => globalThis.document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
