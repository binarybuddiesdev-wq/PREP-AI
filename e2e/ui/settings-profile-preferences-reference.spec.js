import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('settings profile and practice preferences match the reference structure', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const reactPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reference = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await reactPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href);
    await reference.evaluate(() => {
      globalThis.go('app');
      globalThis.showPg('settings');
    });

    const referenceTitle = await reference.locator('#pg-settings > .pg-title').boundingBox();
    const referenceSubtitle = await reference.locator('#pg-settings > .pg-sub').boundingBox();
    const referenceTabs = await reference.locator('#pg-settings > .set-nav').boundingBox();
    const referenceProfilePanel = await reference.locator('#set-profile').boundingBox();
    const referencePanelTitle = await reference.locator('#set-profile > h2').boundingBox();
    const referenceSaveButton = await reference.locator('#set-profile button').boundingBox();
    const referenceActiveTab = await reference.locator('.set-nav-item.on').boundingBox();
    const referencePanelBackground = await reference
      .locator('#set-profile')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const referenceFirstName = await reference
      .locator('#set-profile .set-field input')
      .nth(0)
      .boundingBox();
    const referenceLastName = await reference
      .locator('#set-profile .set-field input')
      .nth(1)
      .boundingBox();
    const referenceEmail = await reference
      .locator('#set-profile .set-field input')
      .nth(2)
      .boundingBox();
    const referenceRole = await reference
      .locator('#set-profile .set-field select')
      .nth(0)
      .boundingBox();
    const referenceCompanies = await reference
      .locator('#set-profile .set-field input')
      .nth(3)
      .boundingBox();

    await reactPage.evaluate(
      async ({ referenceTitle }) => {
        const loadDependency = async (name) => {
          const resource = globalThis.performance
            .getEntriesByType('resource')
            .find((entry) =>
              new globalThis.URL(entry.name).pathname.endsWith(
                `/node_modules/.vite/deps/${name}.js`
              )
            );
          if (!resource) throw new Error(`Vite dependency was not loaded: ${name}`);
          return import(resource.name);
        };
        const react = await loadDependency('react');
        const createElement = react.createElement ?? react.default?.createElement;
        const useState = react.useState ?? react.default?.useState;
        const Component = react.Component ?? react.default?.Component;
        const reactDom = await loadDependency('react-dom_client');
        const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
        const { SettingsFormCard } = await import('/src/components/settings/SettingsFormCard.tsx');
        const preview = globalThis.document.createElement('main');
        preview.id = 'settings-reference-preview';
        preview.style.cssText = `position:fixed;left:${referenceTitle.x}px;top:${referenceTitle.y - 32}px;width:${referenceTitle.width}px`;
        globalThis.document.querySelector('#root').hidden = true;
        globalThis.document.body.append(preview);

        const values = {
          targetRole: 'Full-Stack Engineer',
          experienceLevel: 'Senior',
          targetCompanies: 'Google, Meta, Amazon, Stripe',
          preferredTopics: ['React', 'TypeScript'],
          defaultDifficulty: 'Mid',
          sessionLength: 10,
          timerPerQuestion: 5,
          showHintsOnSkip: true,
          autoAdvance: false,
          dailyReminder: false,
          dailyReminderTime: '19:00',
          timezone: 'Asia/Kolkata',
          weeklyProgressReport: true,
          newQuestionsAlert: false,
          streakMilestoneAlerts: true,
          emailDigest: false,
        };
        const SettingsHarness = () => {
          const [currentValues, setCurrentValues] = useState(values);
          return createElement(
            react.default?.Fragment ?? react.Fragment,
            null,
            createElement(
              'header',
              { className: 'mb-6' },
              createElement(
                'h1',
                { className: 'mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]' },
                'Settings'
              ),
              createElement(
                'p',
                { className: 'text-[0.9rem] text-[var(--dim)]' },
                'Manage your profile and preferences'
              )
            ),
            createElement(SettingsFormCard, {
              values: currentValues,
              userName: 'Abhi Kumar',
              userEmail: 'abhi@company.com',
              isSaving: false,
              status: null,
              onChange: setCurrentValues,
              onSave: () => {
                globalThis.window.__settingsSaved = currentValues;
              },
              onOpenDocuments: () => {},
              planPanel: null,
            })
          );
        };
        class SettingsErrorBoundary extends Component {
          state = { error: null };
          static getDerivedStateFromError(error) {
            return { error };
          }
          componentDidCatch(error) {
            globalThis.window.__settingsHarnessError = error.stack ?? error.message;
          }
          render() {
            return this.state.error ? null : this.props.children;
          }
        }
        createRoot(preview).render(
          createElement(SettingsErrorBoundary, null, createElement(SettingsHarness))
        );
      },
      { referenceTitle }
    );

    const preview = reactPage.locator('#settings-reference-preview');
    await reactPage.waitForTimeout(100);
    const harnessError = await reactPage.evaluate(() => globalThis.window.__settingsHarnessError);
    if (harnessError) throw new Error(harnessError);
    const reactTitle = await preview.locator('h1').boundingBox();
    const reactSubtitle = await preview.locator('header p').boundingBox();
    const reactTabs = await preview.locator('header').nth(1).boundingBox();
    const reactProfilePanel = await preview.locator('section.app-shell-panel').boundingBox();
    const reactPanelTitle = await preview.getByRole('heading', { name: 'Profile' }).boundingBox();
    const reactSaveButton = await preview
      .getByRole('button', { name: 'Save Changes' })
      .boundingBox();
    const reactActiveTab = await preview.getByRole('tab', { name: 'Profile' }).boundingBox();
    const reactPanelBackground = await preview
      .locator('section.app-shell-panel')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const reactFirstName = await preview.getByRole('textbox', { name: 'First Name' }).boundingBox();
    const reactLastName = await preview.getByRole('textbox', { name: 'Last Name' }).boundingBox();
    const reactEmail = await preview.getByRole('textbox', { name: 'Email' }).boundingBox();
    const reactRole = await preview.getByRole('combobox', { name: 'Target Role' }).boundingBox();
    const reactCompanies = await preview
      .getByRole('textbox', { name: 'Target companies' })
      .boundingBox();
    expect(Math.abs(reactTitle.y - referenceTitle.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactTitle.height - referenceTitle.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactSubtitle.y - referenceSubtitle.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactTabs.y - referenceTabs.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactProfilePanel.x - referenceProfilePanel.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactProfilePanel.y - referenceProfilePanel.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactProfilePanel.width - referenceProfilePanel.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactProfilePanel.height - referenceProfilePanel.height)).toBeLessThanOrEqual(
      3
    );
    expect(Math.abs(reactPanelTitle.y - referencePanelTitle.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactPanelTitle.height - referencePanelTitle.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactSaveButton.y - referenceSaveButton.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactActiveTab.height - referenceActiveTab.height)).toBeLessThanOrEqual(3);
    expect(reactPanelBackground).toBe(referencePanelBackground);
    for (const [reactField, referenceField] of [
      [reactFirstName, referenceFirstName],
      [reactLastName, referenceLastName],
      [reactEmail, referenceEmail],
      [reactRole, referenceRole],
      [reactCompanies, referenceCompanies],
    ]) {
      expect(Math.abs(reactField.x - referenceField.x)).toBeLessThanOrEqual(3);
      expect(
        Math.abs(reactField.y - referenceField.y),
        JSON.stringify({ reactField, referenceField })
      ).toBeLessThanOrEqual(3);
      expect(Math.abs(reactField.width - referenceField.width)).toBeLessThanOrEqual(3);
      expect(Math.abs(reactField.height - referenceField.height)).toBeLessThanOrEqual(3);
    }
    await reference.getByRole('button', { name: 'Practice Preferences' }).click();
    await preview.getByRole('tab', { name: 'Practice Preferences' }).click();
    const referencePreferencesPanel = await reference.locator('#set-prefs').boundingBox();
    const reactPreferencesPanel = await preview.locator('section.app-shell-panel').boundingBox();
    const referenceDifficulty = await reference
      .locator('#set-prefs .set-field:first-of-type select')
      .boundingBox();
    const referenceSessionLength = await reference
      .locator('#set-prefs .set-field select')
      .nth(1)
      .boundingBox();
    const referenceTimer = await reference
      .locator('#set-prefs .set-field select')
      .nth(2)
      .boundingBox();
    const referencePreferencesSave = await reference
      .locator('#set-prefs button')
      .last()
      .boundingBox();
    const reactDifficulty = await preview
      .getByRole('combobox', { name: 'Default Difficulty' })
      .boundingBox();
    const reactSessionLength = await preview
      .getByRole('combobox', { name: 'Session Length' })
      .boundingBox();
    const reactTimer = await preview
      .getByRole('combobox', { name: 'Timer per Question' })
      .boundingBox();
    const reactPreferencesSave = await preview
      .getByRole('button', { name: 'Save Preferences' })
      .boundingBox();
    const referenceFirstTopic = await reference
      .locator('#set-prefs .tags .tag')
      .first()
      .boundingBox();
    const reactFirstTopic = await preview.locator('button[aria-pressed]').first().boundingBox();
    expect(
      Math.abs(reactDifficulty.y - referenceDifficulty.y),
      JSON.stringify({ referenceDifficulty, reactDifficulty })
    ).toBeLessThanOrEqual(3);
    expect(Math.abs(reactDifficulty.height - referenceDifficulty.height)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactSessionLength.y - referenceSessionLength.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactTimer.y - referenceTimer.y)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactSessionLength.height - referenceSessionLength.height)).toBeLessThanOrEqual(
      3
    );
    expect(Math.abs(reactTimer.height - referenceTimer.height)).toBeLessThanOrEqual(3);
    expect(Math.abs(reactPreferencesPanel.y - referencePreferencesPanel.y)).toBeLessThanOrEqual(3);
    expect(
      Math.abs(reactPreferencesPanel.height - referencePreferencesPanel.height),
      JSON.stringify({ referencePreferencesPanel, reactPreferencesPanel })
    ).toBeLessThanOrEqual(3);
    expect(
      Math.abs(reactPreferencesSave.y - referencePreferencesSave.y),
      JSON.stringify({ referencePreferencesSave, reactPreferencesSave })
    ).toBeLessThanOrEqual(3);
    expect(
      Math.abs(reactPreferencesSave.width - referencePreferencesSave.width)
    ).toBeLessThanOrEqual(3);
    expect(
      Math.abs(reactPreferencesSave.height - referencePreferencesSave.height)
    ).toBeLessThanOrEqual(3);
    expect(Math.abs(reactFirstTopic.height - referenceFirstTopic.height)).toBeLessThanOrEqual(3);
    expect(await preview.getByText('Preferred Topics', { exact: true }).count()).toBe(1);
    expect(await preview.locator('button[aria-pressed]').allTextContents()).toEqual([
      'React',
      'TypeScript',
      'System Design',
      'DSA',
      'NestJS',
      'Node.js',
    ]);
    const referenceToggles = reference.locator('#set-prefs .toggle-row .toggle-sw');
    const reactToggles = preview.getByRole('switch');
    for (let index = 0; index < 2; index += 1) {
      const referenceToggle = await referenceToggles.nth(index).boundingBox();
      const reactToggle = await reactToggles.nth(index).boundingBox();
      expect(Math.abs(reactToggle.width - referenceToggle.width)).toBeLessThanOrEqual(3);
      expect(Math.abs(reactToggle.height - referenceToggle.height)).toBeLessThanOrEqual(3);
    }
    const nodeTopic = preview.getByRole('button', { name: 'Node.js' });
    await nodeTopic.click();
    await expect(nodeTopic).toHaveAttribute('aria-pressed', 'true');
    await preview.getByRole('combobox', { name: 'Default Difficulty' }).click();
    await reactPage.getByRole('option', { name: 'Senior' }).click();
    await preview.getByRole('combobox', { name: 'Session Length' }).click();
    await reactPage.getByRole('option', { name: '15 questions' }).click();
    await preview.getByRole('combobox', { name: 'Timer per Question' }).click();
    await reactPage.getByRole('option', { name: 'No timer' }).click();
    await reactToggles.nth(0).click();
    await reactToggles.nth(1).click();
    await expect(preview.getByRole('combobox', { name: 'Default Difficulty' })).toContainText(
      'Senior'
    );
    await preview.getByRole('button', { name: 'Save Preferences' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__settingsSaved))
      .toMatchObject({
        defaultDifficulty: 'Senior',
        sessionLength: 15,
        timerPerQuestion: 0,
        showHintsOnSkip: false,
        autoAdvance: true,
        preferredTopics: ['React', 'TypeScript', 'Node.js'],
      });

    await Promise.all([
      reactPage.locator('html').evaluate((element) => (element.dataset.theme = 'light')),
      reference.locator('html').evaluate((element) => (element.dataset.theme = 'light')),
    ]);
    const reactLightPanel = await preview
      .locator('section.app-shell-panel')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const referenceLightPanel = await reference
      .locator('#set-prefs')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    expect(reactLightPanel).toBe(referenceLightPanel);

    await reactPage.setViewportSize({ width: 390, height: 844 });
    await preview.evaluate((element) => {
      element.style.left = '0px';
      element.style.top = '0px';
      element.style.width = '390px';
    });
    await expect(preview.getByRole('tab', { name: 'Practice Preferences' })).toBeVisible();
    await preview.getByRole('tab', { name: 'Profile' }).click();
    const mobileFirstName = await preview
      .getByRole('textbox', { name: 'First Name' })
      .boundingBox();
    const mobileLastName = await preview.getByRole('textbox', { name: 'Last Name' }).boundingBox();
    expect(mobileLastName.y).toBeGreaterThan(mobileFirstName.y);
    expect(
      await reactPage.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth >
          globalThis.document.documentElement.clientWidth
      )
    ).toBe(false);
  } finally {
    await browser.close();
  }
});
