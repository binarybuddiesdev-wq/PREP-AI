import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const readCard = (page, selector) =>
  page.locator(selector).evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });

test('matches all three onboarding step frames at desktop and mobile sizes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const resourceFor = (dependency) =>
      globalThis.performance
        .getEntriesByType('resource')
        .find((entry) =>
          new globalThis.URL(entry.name).pathname.endsWith(
            `/node_modules/.vite/deps/${dependency}.js`
          )
        );
    const react = await import(resourceFor('react').name);
    const reactDom = await import(resourceFor('react-dom_client').name);
    const createElement = react.createElement ?? react.default.createElement;
    const createRoot = reactDom.createRoot ?? reactDom.default.createRoot;
    const { OnboardingWizard } = await import('/src/components/onboarding/OnboardingWizard.tsx');
    const { BrandLink } = await import('/src/components/layout/BrandLink.tsx');
    const router = await import(resourceFor('react-router').name);
    const MemoryRouter = router.MemoryRouter ?? router.default.MemoryRouter;
    const preview = globalThis.document.createElement('div');
    preview.id = 'onboarding-reference-preview';
    globalThis.document.querySelector('#root').hidden = true;
    globalThis.document.body.append(preview);
    const root = createRoot(preview);
    globalThis.renderOnboardingPreview = (step) => {
      const values = {
        targetRole: '',
        experienceLevel: '',
        targetCompanies: '',
        preferredTopics: ['React'],
        defaultDifficulty: 'Mid',
      };
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(OnboardingWizard, {
            brand: createElement(BrandLink, { to: '/', size: 'small' }),
            step,
            values,
            isSaving: false,
            errorMessage: null,
            errorDetails: null,
            onChange: () => {},
            onContinue: () => {},
            onBack: () => {},
            onSkip: () => {},
            onFinish: () => {},
          })
        )
      );
    };
  });
  const referencePage = await page.context().newPage();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await referencePage.setViewportSize(viewport);
    await referencePage.goto(pathToFileURL(resolve('prepai-ui.html')).href, {
      waitUntil: 'networkidle',
    });
    await referencePage.locator('#scr-setup').evaluate((element) => (element.hidden = false));

    for (const step of [1, 2, 3]) {
      const reference = await readCard(referencePage, '.setup-card');

      await page.evaluate((currentStep) => globalThis.renderOnboardingPreview(currentStep), step);
      const card = page.locator('.onboarding-card');
      await expect(card).toBeVisible();
      await expect(page.locator(`li[aria-label^="Step ${step}:"]`)).toHaveAttribute(
        'aria-current',
        'step'
      );
      await page.waitForTimeout(250);
      if (step > 1) {
        await expect(
          page.getByRole('listitem', { name: /Step 1: Role and experience, complete/ })
        ).toContainText('1');
      }
      const implementation = await readCard(page, '.onboarding-card');

      expect(Math.abs(implementation.x - reference.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(implementation.y - reference.y)).toBeLessThanOrEqual(8);
      expect(Math.abs(implementation.width - reference.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(implementation.height - reference.height)).toBeLessThanOrEqual(16);

      if (step === 3) {
        const referenceButtonLines = await referencePage
          .locator('#stp-3 .setup-actions .btn-primary')
          .evaluate((element) => {
            const range = globalThis.document.createRange();
            range.selectNodeContents(element);
            return range.getClientRects().length;
          });
        const implementationButtonLines = await page
          .getByRole('button', { name: 'Start Practicing' })
          .evaluate((element) => {
            const range = globalThis.document.createRange();
            range.selectNodeContents(element);
            return range.getClientRects().length;
          });
        expect(implementationButtonLines).toBe(referenceButtonLines);
      }

      if (step === 1) {
        await referencePage.locator('#setup-role').selectOption('Frontend Engineer');
        await referencePage.locator('#setup-exp').selectOption('Junior');
        await referencePage.locator('#stp-1').getByRole('button', { name: 'Continue' }).click();
        await expect(referencePage.locator('#stp-dot-2')).toHaveClass(/active/);
        await referencePage.waitForTimeout(350);
      } else if (step === 2) {
        await referencePage.locator('#setup-companies').fill('Google, Meta');
        await referencePage.locator('#stp-2').getByRole('button', { name: 'Continue' }).click();
        await expect(referencePage.locator('#stp-dot-3')).toHaveClass(/active/);
        await referencePage.waitForTimeout(350);
      }
    }
  }
  await referencePage.close();
});
