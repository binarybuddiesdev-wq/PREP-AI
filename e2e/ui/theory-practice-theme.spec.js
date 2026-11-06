import { chromium, expect, test } from '@playwright/test';

test('renders theory practice setup, question, feedback, and completion in both themes', async () => {
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
      const [setupModule, questionModule, feedbackModule, completeModule] = await Promise.all([
        import('/src/components/practice/PracticeSetup.tsx'),
        import('/src/components/practice/TheoryQuestionCard.tsx'),
        import('/src/components/practice/TheoryFeedback.tsx'),
        import('/src/components/practice/TheorySessionComplete.tsx'),
      ]);

      const now = '2026-11-01T10:00:00.000Z';
      const topic = {
        id: 'react',
        name: 'React',
        slug: 'react',
        category: 'practice',
        icon: null,
        createdAt: now,
        updatedAt: now,
      };
      const answer = {
        id: 'answer-1',
        sessionId: 'session-1',
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
        startedAt: now,
        completedAt: now,
        timeTaken: 20,
        createdAt: now,
        updatedAt: now,
      };
      const session = {
        id: 'session-1',
        topicId: 'react',
        mode: 'topic',
        difficulty: 'Mid',
        totalQuestions: 10,
        questionsAnswered: 1,
        avgScore: 8,
        status: 'completed',
        startedAt: now,
        completedAt: now,
        createdAt: now,
      };
      const preview = globalThis.document.createElement('main');
      preview.id = 'theory-practice-preview';
      preview.className = 'mx-auto w-full max-w-5xl space-y-5 p-4';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);

      const mount = (id, component) => {
        const section = globalThis.document.createElement('section');
        section.id = id;
        preview.append(section);
        createRoot(section).render(component);
      };

      mount(
        'practice-setup',
        createElement(setupModule.PracticeSetup, {
          mode: 'topic',
          topicId: 'react',
          difficulty: 'Mid',
          totalQuestions: 10,
          isPremium: false,
          dailySessions: { used: 1, limit: 3 },
          isDailySessionsLoading: false,
          isDailySessionsFetching: false,
          dailySessionsError: null,
          onRetryDailySessions: () => {},
          topics: [topic],
          weakAreas: [],
          pdfSources: [],
          selectedPdfIds: [],
          isPdfSourcesLoading: false,
          pdfSourcesError: null,
          onRetryPdfSources: () => {},
          onPdfSelectionChange: () => {},
          onManageDocuments: () => {},
          isTopicsLoading: false,
          topicsError: null,
          onRetryTopics: () => {},
          isWeakAreasLoading: false,
          weakAreasError: null,
          onRetryWeakAreas: () => {},
          isStarting: false,
          startError: null,
          onModeChange: () => {},
          onTopicChange: () => {},
          onDifficultyChange: () => {},
          onStart: () => {},
        })
      );
      mount(
        'practice-question',
        createElement(
          router.MemoryRouter,
          null,
          createElement(questionModule.TheoryQuestionCard, {
            question: {
              id: 'question-1',
              question: 'How does React preserve state between renders?',
              topicId: 'react',
              difficulty: 'Mid',
            },
            currentQuestion: 1,
            totalQuestions: 3,
            elapsedSeconds: 18,
            answerDraft: 'React stores it.',
            isSubmitting: false,
            isAnswerFrozen: false,
            submitError: null,
            submitted: false,
            onAnswerChange: () => {},
            onSubmit: () => {},
            onSkip: () => {},
            onEnd: () => {},
          })
        )
      );
      mount(
        'practice-feedback',
        createElement(feedbackModule.TheoryFeedback, {
          answer,
          evaluationError: 'Evaluation could not be refreshed.',
          isRefreshing: false,
          isEnding: false,
          isCompleting: false,
          canContinue: true,
          onRetryEvaluation: () => {},
          onContinue: () => {},
          onEnd: () => {},
        })
      );
      mount(
        'practice-complete',
        createElement(completeModule.TheorySessionComplete, {
          session,
          answers: [answer],
          onPracticeAgain: () => {},
        })
      );
    });

    const setupCard = page
      .getByRole('heading', { name: 'Choose a topic' })
      .locator('xpath=ancestor::section[1]');
    const questionCard = page
      .getByRole('heading', { name: 'How does React preserve state between renders?' })
      .locator('xpath=ancestor::section[1]');
    const feedbackCard = page.getByRole('region', { name: 'Answer feedback' });
    const completeCard = page.locator('#practice-complete main');
    const evaluationError = page.getByText('Evaluation could not be refreshed.', { exact: true });
    await expect(setupCard).toBeVisible();
    await expect(page.locator('#practice-setup').getByRole('status')).toContainText(
      '2 of 3 sessions left today'
    );
    await expect(questionCard).toBeVisible();
    await expect(feedbackCard).toBeVisible();
    await expect(completeCard).toBeVisible();

    const cards = [setupCard, questionCard, feedbackCard, completeCard];
    for (const card of cards) {
      await expect
        .poll(() =>
          card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgb(24, 24, 27)');
    }
    await expect
      .poll(() => evaluationError.evaluate((element) => globalThis.getComputedStyle(element).color))
      .toBe('rgb(253, 164, 175)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    for (const card of cards) {
      await expect
        .poll(() =>
          card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
        )
        .toBe('rgb(255, 255, 255)');
    }
    await expect
      .poll(() => evaluationError.evaluate((element) => globalThis.getComputedStyle(element).color))
      .toBe('rgb(190, 18, 60)');

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.locator('#theory-practice-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
