import { chromium, expect, test } from '@playwright/test';

test('renders coding problem details and AI review in both themes without mobile overflow', async () => {
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

      const { CodingProblemDetail } =
        await import('/src/components/coding/CodingProblemDetail.tsx');
      const { CodingReviewDialog } = await import('/src/components/coding/CodingReviewDialog.tsx');
      const preview = globalThis.document.createElement('main');
      preview.id = 'coding-workspace-preview';
      preview.className = 'mx-auto w-full max-w-6xl space-y-5 p-4';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);

      const problem = {
        id: 'two-sum',
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two numbers that add up to the target.',
        difficulty: 'Easy',
        topic: 'Arrays',
        examples: [{ input: [[2, 7], 9], output: [0, 1], explanation: 'Add the target values.' }],
        constraints: ['Two values exist.'],
        codeJs: 'function twoSum() {}',
        codeTs: 'function twoSum(): number[] { return []; }',
        codePy: 'def two_sum():\n    pass',
      };
      const answer = {
        id: 'answer-one',
        executionId: 'execution-one',
        sessionId: 'session-one',
        userId: 'user-one',
        problemId: problem.id,
        language: 'javascript',
        code: problem.codeJs,
        status: 'accepted',
        testCasesPassed: 1,
        testCasesTotal: 1,
        runtime: 3,
        memoryUsage: 2,
        createdAt: '2026-11-05T10:00:02.000Z',
        aiReviewStatus: 'completed',
        aiReviewJson: {
          summary: 'A direct solution with clear lookup behavior.',
          timeComplexity: 'O(n)',
          spaceComplexity: 'O(n)',
          strengths: ['Uses a single pass'],
          improvements: ['Validate input length'],
        },
        aiReviewFailureMessage: null,
      };
      const onOpenChange = () => {};
      createRoot(preview).render(
        createElement(
          react.default?.Fragment ?? react.Fragment,
          null,
          createElement(CodingProblemDetail, { problem, onBack: () => {} }),
          createElement(CodingReviewDialog, {
            isOpen: true,
            problemTitle: problem.title,
            answer,
            isRequestPending: false,
            requestError: null,
            onOpenChange,
            onRequestReview: () => {},
          })
        )
      );
    });

    const preview = page.locator('#coding-workspace-preview');
    const detailCard = page.locator('article > div').first();
    const reviewDialog = page.getByRole('dialog', { name: 'AI Review: Two Sum' });
    await expect(page.locator('#coding-workspace-preview h1')).toBeVisible();
    await expect(reviewDialog).toBeVisible();
    await expect
      .poll(() =>
        detailCard.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() =>
        reviewDialog.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        detailCard.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        reviewDialog.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() => preview.evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
