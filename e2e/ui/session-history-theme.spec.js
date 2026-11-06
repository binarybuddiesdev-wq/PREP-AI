import { chromium, expect, test } from '@playwright/test';

test('renders practice and coding history surfaces in both themes without mobile overflow', async () => {
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

      const { SessionHistoryTable } =
        await import('/src/components/history/SessionHistoryTable.tsx');
      const { SessionHistoryRow } = await import('/src/components/history/SessionHistoryRow.tsx');
      const { CodingSessionHistoryTable } =
        await import('/src/components/history/CodingSessionHistoryTable.tsx');
      const { CodingSessionHistoryRow } =
        await import('/src/components/history/CodingSessionHistoryRow.tsx');

      const practiceSession = {
        id: 'practice-session',
        topicId: 'react',
        mode: 'topic',
        difficulty: 'Mid',
        totalQuestions: 10,
        questionsAnswered: 1,
        avgScore: 8,
        status: 'completed',
        startedAt: '2026-11-01T10:00:00.000Z',
        completedAt: '2026-11-01T10:20:00.000Z',
        createdAt: '2026-11-01T10:00:00.000Z',
      };
      const practiceDetail = {
        ...practiceSession,
        answers: [
          {
            id: 'practice-answer',
            sessionId: practiceSession.id,
            questionId: 'question-1',
            questionText: 'What is a React hook?',
            userAnswer: 'A function that uses React features.',
            aiScore: 8,
            aiFeedback: 'A clear answer.',
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
      const codingSession = {
        id: 'coding-session',
        problemIds: ['problem-1'],
        problemsAttempted: 1,
        problemsSolved: 1,
        status: 'completed',
        startedAt: '2026-11-02T10:00:00.000Z',
        completedAt: '2026-11-02T10:12:00.000Z',
        createdAt: '2026-11-02T10:00:00.000Z',
      };
      const codingDetail = {
        ...codingSession,
        userId: 'user-1',
        answers: [
          {
            id: 'coding-answer',
            executionId: 'execution-1',
            sessionId: codingSession.id,
            userId: 'user-1',
            problemId: 'problem-1',
            language: 'javascript',
            code: 'return 42;',
            status: 'accepted',
            testCasesPassed: 2,
            testCasesTotal: 2,
            runtime: 5,
            memoryUsage: 8,
            createdAt: '2026-11-02T10:10:00.000Z',
            aiReviewStatus: 'queued',
            aiReviewJson: null,
            aiReviewFailureMessage: null,
          },
        ],
      };

      globalThis.document.querySelector('#root').hidden = true;
      const preview = globalThis.document.createElement('main');
      preview.id = 'session-history-preview';
      preview.className = 'mx-auto w-full max-w-6xl space-y-5 p-4';
      globalThis.document.body.append(preview);
      const createSection = (id, title) => {
        const section = globalThis.document.createElement('section');
        section.id = id;
        section.setAttribute('aria-label', title);
        preview.append(section);
        return section;
      };

      createRoot(createSection('practice-history', 'Practice history')).render(
        createElement(
          SessionHistoryTable,
          {
            hasSessions: true,
            page: 1,
            limit: 20,
            total: 1,
            isLoading: false,
            errorMessage: null,
            onRetryHistory: () => {},
            onPageChange: () => {},
            onStartPractice: () => {},
          },
          createElement(SessionHistoryRow, {
            session: practiceSession,
            isExpanded: true,
            detail: practiceDetail,
            isDetailLoading: false,
            detailError: null,
            onToggle: () => {},
            onRetry: () => {},
          })
        )
      );

      createRoot(createSection('coding-history', 'Coding history')).render(
        createElement(
          CodingSessionHistoryTable,
          {
            hasSessions: true,
            page: 1,
            limit: 20,
            total: 1,
            isLoading: false,
            errorMessage: null,
            problemTitleErrorMessage: null,
            onRetryHistory: () => {},
            onRetryProblemTitles: () => {},
            onPageChange: () => {},
            onStartCoding: () => {},
          },
          createElement(CodingSessionHistoryRow, {
            session: codingSession,
            problemTitles: new Map([['problem-1', 'Two Sum']]),
            isExpanded: true,
            detail: codingDetail,
            isDetailLoading: false,
            detailError: null,
            onToggle: () => {},
            onRetry: () => {},
          })
        )
      );
    });

    const practiceCard = page.locator('#practice-history > section > div').first();
    const codingCard = page.locator('#coding-history > section > div').first();
    await expect(practiceCard).toBeVisible();
    await expect(codingCard).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(2);

    for (const surface of [practiceCard, codingCard]) {
      await expect
        .poll(() =>
          surface.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgb(24, 24, 27)');
    }
    for (const article of await page.locator('#practice-history').getByRole('article').all()) {
      await expect
        .poll(() =>
          article.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgba(255, 255, 255, 0.04)');
    }
    for (const article of await page.locator('#coding-history').getByRole('article').all()) {
      await expect
        .poll(() =>
          article.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgb(24, 24, 27)');
    }

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    for (const surface of [practiceCard, codingCard]) {
      await expect
        .poll(() =>
          surface.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgb(255, 255, 255)');
    }
    for (const article of await page.locator('#practice-history').getByRole('article').all()) {
      await expect
        .poll(() =>
          article.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgba(0, 0, 0, 0.04)');
    }
    for (const article of await page.locator('#coding-history').getByRole('article').all()) {
      await expect
        .poll(() =>
          article.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgb(255, 255, 255)');
    }

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.locator('#session-history-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
