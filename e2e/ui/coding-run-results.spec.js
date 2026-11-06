import { chromium, expect, test } from '@playwright/test';

test('shows readable Two Sum input and output in the coding results panel', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 840 } });

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
      const { CodingProblemWorkspace } =
        await import('/src/components/coding/CodingProblemWorkspace.tsx');
      const preview = globalThis.document.createElement('div');
      preview.id = 'coding-run-results-preview';
      preview.style.height = '680px';
      preview.style.width = '100%';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);

      const problem = {
        id: 'two-sum',
        title: 'Two Sum',
        slug: 'two-sum',
        description: 'Find two values that add up to the target.',
        difficulty: 'Easy',
        topic: 'Arrays',
        examples: [{ input: [[2, 7, 11, 15], 9], output: [0, 1] }],
        constraints: ['Only one valid answer exists.'],
        codeJs: 'function solution(nums, target) {}',
        codeTs: 'function solution(nums: number[], target: number): number[] { return []; }',
        codePy: 'def solution(nums, target):\n    return []',
      };
      const execution = {
        id: 'execution-one',
        sessionId: 'session-one',
        problemId: problem.id,
        operation: 'run',
        language: 'javascript',
        status: 'completed',
        result: {
          status: 'wrong_answer',
          testCasesPassed: 1,
          testCasesTotal: 2,
          testCases: [
            { input: [[2, 7, 11, 15], 9], expected: [0, 1], got: [0, 1], passed: true },
            { input: [[3, 2, 4], 6], expected: [1, 2], got: [2, 1], passed: false },
          ],
          runtime: null,
          memoryUsage: null,
        },
        failureMessage: null,
        createdAt: '2026-11-06T08:00:00.000Z',
        startedAt: '2026-11-06T08:00:01.000Z',
        completedAt: '2026-11-06T08:00:02.000Z',
        answer: null,
      };
      const noop = () => {};
      createRoot(preview).render(
        createElement(CodingProblemWorkspace, {
          problem,
          language: 'javascript',
          code: problem.codeJs,
          outputTab: 'testcases',
          isProblemCollapsed: false,
          isFullscreen: false,
          execution,
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
      );
    });

    const results = page.getByRole('region', { name: 'Run results' });
    await expect(results.getByText('1 of 2 test cases passed')).toBeVisible();
    await expect(results.getByText('[[2,7,11,15],9]')).toBeVisible();
    await expect(results.getByText('[0,1]')).toHaveCount(2);
    await expect(results.getByText('[0,1]').first()).toBeVisible();
    await expect(results.getByText('[2,1]')).toBeVisible();

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 840 });
      await expect
        .poll(() =>
          page.locator('#coding-run-results-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(width);
    }
  } finally {
    await browser.close();
  }
});
