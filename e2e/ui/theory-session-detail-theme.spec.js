import { chromium, expect, test } from '@playwright/test';

test('renders theory session details and completion errors in both themes', async () => {
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
      const { TheorySessionDetail } =
        await import('/src/components/history/TheorySessionDetail.tsx');
      const session = {
        id: 'session-1',
        topicId: 'react',
        mode: 'topic',
        difficulty: 'Mid',
        totalQuestions: 10,
        questionsAnswered: 1,
        avgScore: 8,
        status: 'in_progress',
        startedAt: '2026-11-01T10:00:00.000Z',
        completedAt: null,
        createdAt: '2026-11-01T10:00:00.000Z',
        answers: [
          {
            id: 'answer-1',
            sessionId: 'session-1',
            questionId: 'question-1',
            questionText: 'What is a React hook?',
            userAnswer: 'A function that uses React features.',
            aiScore: 8,
            aiFeedback: 'A clear explanation.',
            evaluationProvider: 'provider',
            evaluationModel: 'model',
            evaluationPromptVersion: 'v1',
            status: 'completed',
            failureMessage: null,
            startedAt: '2026-11-01T10:01:00.000Z',
            completedAt: '2026-11-01T10:01:03.000Z',
            timeTaken: 42,
            createdAt: '2026-11-01T10:01:00.000Z',
            updatedAt: '2026-11-01T10:01:03.000Z',
          },
        ],
      };

      globalThis.document.querySelector('#root').hidden = true;
      const preview = globalThis.document.createElement('div');
      preview.id = 'theory-session-detail-preview';
      preview.className = 'p-4';
      globalThis.document.body.append(preview);
      createRoot(preview).render(
        createElement(TheorySessionDetail, {
          session,
          isCompleting: false,
          completionError: 'The session could not be completed.',
          onComplete: () => {},
          onReturnToHistory: () => {},
        })
      );
    });

    const summary = page
      .getByRole('heading', { name: 'Session details' })
      .locator('xpath=ancestor::section[1]');
    const answerCard = page.getByRole('article');
    const completionError = page.getByText('The session could not be completed.', { exact: true });
    await expect(summary).toBeVisible();
    await expect(answerCard).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish saved session' })).toBeVisible();
    await expect
      .poll(() =>
        summary.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() =>
        answerCard.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() => completionError.evaluate((element) => globalThis.getComputedStyle(element).color))
      .toBe('rgb(253, 164, 175)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        summary.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        answerCard.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() => completionError.evaluate((element) => globalThis.getComputedStyle(element).color))
      .toBe('rgb(190, 18, 60)');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.locator('#theory-session-detail-preview').evaluate((element) => element.scrollWidth)
      )
      .toBeLessThanOrEqual(390);
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
