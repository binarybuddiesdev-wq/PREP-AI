import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('settings notifications and AI sources retain reference layout and real controls', async () => {
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
    await reference.getByRole('button', { name: 'Notifications' }).click();
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
        const reactDom = await loadDependency('react-dom_client');
        const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
        const { SettingsFormCard } = await import('/src/components/settings/SettingsFormCard.tsx');
        const { SettingsPlanPanel } =
          await import('/src/components/settings/SettingsPlanPanel.tsx');
        const preview = globalThis.document.createElement('main');
        preview.id = 'settings-secondary-reference-preview';
        preview.style.cssText = `position:fixed;left:${referenceTitle.x}px;top:${referenceTitle.y - 32}px;width:${referenceTitle.width}px`;
        globalThis.document.querySelector('#root').hidden = true;
        globalThis.document.body.append(preview);

        const initialValues = {
          targetRole: 'Full-Stack Engineer',
          experienceLevel: 'Senior',
          targetCompanies: '',
          preferredTopics: ['React'],
          defaultDifficulty: 'Mid',
          sessionLength: 10,
          timerPerQuestion: 5,
          showHintsOnSkip: true,
          autoAdvance: false,
          dailyReminder: true,
          dailyReminderTime: '19:00',
          timezone: 'Asia/Kolkata',
          weeklyProgressReport: true,
          newQuestionsAlert: false,
          streakMilestoneAlerts: true,
          emailDigest: false,
        };
        const sources = [
          'React Fundamentals.pdf',
          'NestJS Guide.pdf',
          'TypeScript Handbook.pdf',
          'System Design Patterns.pdf',
          'DSA Concepts.pdf',
        ].map((displayName, index) => ({
          id: `pdf-${index + 1}`,
          displayName,
          byteSize: (index + 2) * 1024 * 1024,
          pageCount: 142 - index * 11,
          status: 'ready',
          activeRevision: 1,
          failureCode: null,
          createdAt: '2026-11-06T00:00:00.000Z',
          updatedAt: '2026-11-06T00:00:00.000Z',
        }));
        const Harness = () => {
          const [values, setValues] = useState(initialValues);
          const [activeTab, setActiveTab] = useState('notifications');
          const planPanel = createElement(SettingsPlanPanel, {
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
              isLoading: false,
              errorMessage: null,
              createErrorMessage: null,
              createdSubscription: null,
              isCreating: false,
              cancelErrorMessage: null,
              isCancelling: false,
              onRetry: () => {},
              onCreateCheckout: (plan) => {
                globalThis.window.__selectedPlan = plan;
              },
              onCancelSubscription: () => {},
            },
          });
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
              values,
              userName: 'Abhi Kumar',
              userEmail: 'abhi@company.com',
              isSaving: false,
              status: null,
              activeTab,
              onActiveTabChange: setActiveTab,
              onChange: setValues,
              onSave: () => {
                globalThis.window.__settingsSaved = values;
              },
              onOpenDocuments: () => {
                globalThis.window.__openDocuments = true;
              },
              planPanel,
              pdfSources: sources,
              isLoadingPdfSources: false,
              pdfSourcesError: null,
              deletingPdfId: null,
              onRetryPdfSources: () => {},
              onDeletePdfSource: (id) => {
                globalThis.window.__removedPdfId = id;
              },
            })
          );
        };
        createRoot(preview).render(createElement(Harness));
      },
      { referenceTitle }
    );

    const preview = reactPage.locator('#settings-secondary-reference-preview');
    await expect(preview.getByRole('tab', { name: 'Notifications' })).toBeVisible();
    const referenceRows = reference.locator('#set-notifications .toggle-row');
    const reactRows = preview.getByRole('switch').locator('xpath=..');
    for (let index = 0; index < 5; index += 1) {
      const referenceRow = await referenceRows.nth(index).boundingBox();
      const reactRow = await reactRows.nth(index).boundingBox();
      expect(
        Math.abs(reactRow.y - referenceRow.y),
        JSON.stringify({ index, reactRow, referenceRow })
      ).toBeLessThanOrEqual(3);
      expect(Math.abs(reactRow.height - referenceRow.height)).toBeLessThanOrEqual(3);
    }
    const referenceNotificationSave = await reference
      .locator('#set-notifications button')
      .last()
      .boundingBox();
    const reactNotificationSave = await preview
      .getByRole('button', { name: 'Save Preferences' })
      .boundingBox();
    expect(Math.abs(reactNotificationSave.y - referenceNotificationSave.y)).toBeLessThanOrEqual(3);

    await reference.locator('#set-notifications .toggle-sw').nth(1).click();
    await preview.getByRole('switch', { name: 'Weekly Progress Report' }).click();
    await preview.getByRole('button', { name: 'Save Preferences' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__settingsSaved))
      .toMatchObject({ weeklyProgressReport: false });

    await reference.getByRole('button', { name: 'AI & Sources' }).click();
    await preview.getByRole('tab', { name: 'AI & Sources' }).click();
    const referenceModel = await reference.locator('#set-ai > div').first().boundingBox();
    const reactModel = await preview
      .locator('[aria-labelledby="settings-ai-model-title"]')
      .boundingBox();
    expect(Math.abs(reactModel.y - referenceModel.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(reactModel.width - referenceModel.width)).toBeLessThanOrEqual(2);
    await expect(
      preview.getByText('AI provider and model are managed by your server configuration.')
    ).toBeVisible();
    const referencePdf = await reference.locator('#set-ai .pdf-card').first().boundingBox();
    const reactPdf = await preview
      .locator('[aria-label="PDF question sources"] li')
      .first()
      .boundingBox();
    expect(
      Math.abs(reactPdf.y - referencePdf.y),
      JSON.stringify({ reactModel, referenceModel, reactPdf, referencePdf })
    ).toBeLessThanOrEqual(5);
    expect(Math.abs(reactPdf.height - referencePdf.height)).toBeLessThanOrEqual(5);
    const pdfSwitch = preview.getByRole('switch', {
      name: 'Include React Fundamentals.pdf as a question source',
    });
    expect(pdfSwitch).toHaveAttribute('aria-checked', 'true');
    await pdfSwitch.click();
    await expect(pdfSwitch).toHaveAttribute('aria-checked', 'false');
    expect(await preview.getByRole('switch', { name: 'Web Search' }).isDisabled()).toBe(true);

    await reference.getByRole('button', { name: 'Documents' }).click();
    await preview.getByRole('tab', { name: 'Documents' }).click();
    const referencePdfDropzone = await reference.locator('#set-docs .pdf-drop').boundingBox();
    const reactPdfDropzone = await preview
      .getByRole('button', { name: 'Upload or manage PDFs' })
      .boundingBox();
    expect(
      Math.abs(reactPdfDropzone.y - referencePdfDropzone.y),
      JSON.stringify({ reactPdfDropzone, referencePdfDropzone })
    ).toBeLessThanOrEqual(5);
    expect(Math.abs(reactPdfDropzone.width - referencePdfDropzone.width)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(reactPdfDropzone.height - referencePdfDropzone.height),
      JSON.stringify({ reactPdfDropzone, referencePdfDropzone })
    ).toBeLessThanOrEqual(5);
    await preview.getByRole('button', { name: 'Upload or manage PDFs' }).click();
    await expect.poll(() => reactPage.evaluate(() => globalThis.window.__openDocuments)).toBe(true);

    await Promise.all([
      reactPage.locator('html').evaluate((element) => (element.dataset.theme = 'light')),
      reference.locator('html').evaluate((element) => (element.dataset.theme = 'light')),
    ]);
    const reactPanelBackground = await preview
      .locator('section.app-shell-panel')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const referencePanelBackground = await reference
      .locator('#set-ai')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    expect(reactPanelBackground).toBe(referencePanelBackground);

    await reference.getByRole('button', { name: 'Danger Zone' }).click();
    await preview.getByRole('tab', { name: 'Danger Zone' }).click();
    const referenceDangerRows = reference.locator('#set-danger > div[style*="border:1px solid"]');
    const reactDangerRows = preview.locator('[aria-labelledby^="settings-danger-"]');
    await expect(reactDangerRows).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      const referenceRow = await referenceDangerRows.nth(index).boundingBox();
      const reactRow = await reactDangerRows.nth(index).boundingBox();
      expect(
        Math.abs(reactRow.y - referenceRow.y),
        JSON.stringify({ index, reactRow, referenceRow })
      ).toBeLessThanOrEqual(5);
      expect(Math.abs(reactRow.height - referenceRow.height)).toBeLessThanOrEqual(8);
    }
    await expect(preview.getByRole('button', { name: 'Reset Progress' })).toBeDisabled();
    await expect(preview.getByRole('button', { name: 'Delete Account' })).toBeDisabled();
    await expect(preview.getByRole('button', { name: 'Export Data' })).toBeDisabled();

    await reference.getByRole('button', { name: 'Plan' }).click();
    await preview.getByRole('tab', { name: 'Plan' }).click();
    const referencePlanCard = await reference.locator('#plan-current-card').boundingBox();
    const reactPlanCard = await preview.getByRole('region', { name: 'Current plan' }).boundingBox();
    expect(
      Math.abs(reactPlanCard.y - referencePlanCard.y),
      JSON.stringify({ reactPlanCard, referencePlanCard })
    ).toBeLessThanOrEqual(8);
    expect(Math.abs(reactPlanCard.width - referencePlanCard.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactPlanCard.height - referencePlanCard.height)).toBeLessThanOrEqual(8);
    const referenceLimits = reference.locator('#plan-current-card .plan-limit-item');
    const reactLimits = preview.locator('[aria-label="Daily limits"] > div');
    for (let index = 0; index < 4; index += 1) {
      const referenceLimit = await referenceLimits.nth(index).boundingBox();
      const reactLimit = await reactLimits.nth(index).boundingBox();
      expect(
        Math.abs(reactLimit.y - referenceLimit.y),
        JSON.stringify({ index, reactLimit, referenceLimit })
      ).toBeLessThanOrEqual(4);
      expect(Math.abs(reactLimit.height - referenceLimit.height)).toBeLessThanOrEqual(3);
    }
    expect(await preview.getByText('2 / 3').isVisible()).toBe(true);
    await reference.locator('#plan-modal-monthly').click();
    await preview.getByRole('button', { name: /monthly/i }).click();
    const referenceMonthly = await reference.locator('#plan-modal-monthly').boundingBox();
    const reactMonthly = await preview.getByRole('button', { name: /monthly/i }).boundingBox();
    expect(
      Math.abs(reactMonthly.y - referenceMonthly.y),
      JSON.stringify({ reactMonthly, referenceMonthly })
    ).toBeLessThanOrEqual(8);
    expect(Math.abs(reactMonthly.width - referenceMonthly.width)).toBeLessThanOrEqual(8);
    expect(Math.abs(reactMonthly.height - referenceMonthly.height)).toBeLessThanOrEqual(12);
    await preview.getByRole('button', { name: 'Upgrade to Premium' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__selectedPlan))
      .toBe('monthly');
    expect(await preview.getByRole('button', { name: /yearly/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    await reactPage.setViewportSize({ width: 390, height: 844 });
    await preview.evaluate((element) => {
      element.style.left = '0px';
      element.style.top = '0px';
      element.style.width = '390px';
    });
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
