import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('coding workspace geometry and surfaces match the reference', async () => {
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
      globalThis.showPg('coding');
      globalThis.selectProblem(0);
    });

    const referenceTitle = await reference.locator('#pg-coding > .pg-title').boundingBox();
    const referenceSubtitle = await reference.locator('#pg-coding > .pg-sub').boundingBox();
    const referenceStats = await reference.locator('#coding-stats-bar').boundingBox();
    const referenceDetail = await reference.locator('#code-detail-view').boundingBox();
    const referenceGrid = await reference.locator('#code-layout').boundingBox();
    const referenceProblem = await reference.locator('.code-problem').boundingBox();
    const referenceProblemHeader = await reference.locator('.code-problem-head').boundingBox();
    const referenceExample = await reference.locator('.code-example').first().boundingBox();
    const referenceEditor = await reference.locator('.code-editor-wrap').boundingBox();
    const referenceEditorHeader = await reference.locator('.code-editor-header').boundingBox();
    const referenceOutput = await reference.locator('.code-output-wrap').boundingBox();
    const referenceOutputTabs = await reference.locator('.code-output-tabs').boundingBox();
    const referenceOutputBackground = await reference
      .locator('.code-output-tabs')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const referenceEditorHeaderBackground = await reference
      .locator('.code-editor-header')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);

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
        const reactDom = await loadDependency('react-dom_client');
        const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
        const { CodingProblemWorkspace } =
          await import('/src/components/coding/CodingProblemWorkspace.tsx');
        const { CodingStatsBar } = await import('/src/components/coding/CodingStatsBar.tsx');
        const preview = globalThis.document.createElement('main');
        preview.id = 'coding-workspace-reference-preview';
        preview.style.cssText = `position:fixed;left:${referenceTitle.x}px;top:${referenceTitle.y - 32}px;width:${referenceTitle.width}px`;
        globalThis.document.querySelector('#root').hidden = true;
        globalThis.document.body.append(preview);
        const problem = {
          id: 'two-sum',
          title: 'Two Sum',
          slug: 'two-sum',
          description:
            'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
          difficulty: 'Easy',
          topic: 'Arrays',
          examples: [
            {
              input: [[2, 7, 11, 15], 9],
              output: [0, 1],
              explanation: 'nums[0] + nums[1] == 9',
            },
            { input: [[3, 2, 4], 6], output: [1, 2] },
          ],
          constraints: [
            '2 <= nums.length <= 10^4',
            '-10^9 <= nums[i] <= 10^9',
            'Only one valid answer exists.',
          ],
          codeJs: 'function twoSum(nums, target) {\n  \n}',
          codeTs: 'function twoSum(nums: number[], target: number[]): number[] {\n  \n}',
          codePy: 'def two_sum(nums, target):\n    pass',
        };
        const noop = () => {};
        createRoot(preview).render(
          createElement(
            react.default?.Fragment ?? react.Fragment,
            null,
            createElement(
              'header',
              { className: 'mb-6' },
              createElement(
                'h1',
                { className: 'mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]' },
                problem.title
              ),
              createElement(
                'p',
                { className: 'mb-6 text-[0.9rem] text-[var(--dim)]' },
                `${problem.difficulty} • ${problem.topic}`
              )
            ),
            createElement(CodingStatsBar, {
              stats: {
                solved: 0,
                dailySolved: { used: 0, limit: 5 },
                dailyReviews: { used: 0, limit: 3 },
                streakDays: 0,
              },
              isLoading: false,
              isRetrying: false,
              errorMessage: null,
              onRetry: noop,
            }),
            createElement(CodingProblemWorkspace, {
              problem,
              language: 'javascript',
              code: problem.codeJs,
              outputTab: 'output',
              isProblemCollapsed: false,
              isFullscreen: false,
              execution: null,
              isActionPending: false,
              actionError: null,
              executionReadError: null,
              reviewActionPending: false,
              reviewActionError: null,
              onBack: noop,
              onLanguageChange: noop,
              onCodeChange: noop,
              onResetCode: noop,
              onOutputTabChange: noop,
              onToggleProblem: noop,
              onToggleFullscreen: noop,
              onRun: noop,
              onSubmit: noop,
              onRetry: noop,
              onRetryExecutionRead: noop,
              onRequestReview: noop,
            })
          )
        );
      },
      { referenceTitle }
    );

    const preview = reactPage.locator('#coding-workspace-reference-preview');
    const reactTitle = await preview.locator('h1').boundingBox();
    const reactSubtitle = await preview.locator('header p').boundingBox();
    const reactStats = await preview
      .getByRole('group', { name: 'Coding statistics' })
      .boundingBox();
    const reactBackButton = await preview
      .getByRole('button', { name: 'Back to Problems' })
      .boundingBox();
    const grid = await preview.getByTestId('coding-workspace-grid').boundingBox();
    const problem = await preview.locator('.coding-workspace-grid > section').first().boundingBox();
    const problemHeader = await preview
      .locator('.coding-workspace-grid > section > div')
      .first()
      .boundingBox();
    const example = await preview.getByRole('figure', { name: 'Example 1' }).boundingBox();
    const editor = await preview
      .locator('.coding-workspace-grid > div > section')
      .first()
      .boundingBox();
    const editorHeader = await preview
      .locator('.coding-workspace-grid > div > section > header')
      .first()
      .boundingBox();
    const output = await preview.getByRole('region', { name: 'Run results' }).boundingBox();
    const outputTabs = await preview
      .getByRole('tablist', { name: 'Run result views' })
      .boundingBox();
    const outputBackground = await preview
      .getByRole('tablist', { name: 'Run result views' })
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const editorHeaderBackground = await preview
      .locator('.coding-workspace-grid > div > section > header')
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);

    expect(Math.abs(reactTitle.y - referenceTitle.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactTitle.height - referenceTitle.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactSubtitle.y - referenceSubtitle.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactStats.y - referenceStats.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactStats.height - referenceStats.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactBackButton.y - (referenceDetail.y + 0.5))).toBeLessThanOrEqual(2);
    expect(Math.abs(grid.x - referenceGrid.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(grid.y - referenceGrid.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(problem.width - referenceProblem.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(problemHeader.height - referenceProblemHeader.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(example.x - referenceExample.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(example.y - referenceExample.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(example.height - referenceExample.height)).toBeLessThanOrEqual(3);
    expect(Math.abs(editor.width - referenceEditor.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(editor.y - referenceEditor.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(editorHeader.height - referenceEditorHeader.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(output.width - referenceOutput.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(outputTabs.height - referenceOutputTabs.height)).toBeLessThanOrEqual(2);
    expect(outputBackground).toBe(referenceOutputBackground);
    expect(editorHeaderBackground).toBe(referenceEditorHeaderBackground);

    await reactPage.setViewportSize({ width: 390, height: 844 });
    await preview.evaluate((element) => {
      element.style.left = '0px';
      element.style.top = '0px';
      element.style.width = '390px';
    });
    await expect(preview.getByRole('button', { name: 'Run' })).toBeVisible();
    await expect(preview.getByRole('combobox', { name: 'Programming language' })).toBeVisible();
    const mobileOverflow = await reactPage.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth >
        globalThis.document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);
  } finally {
    await browser.close();
  }
});
