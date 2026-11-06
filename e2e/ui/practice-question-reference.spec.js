import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('active practice question and evaluation follow the reference flow and layout', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reference = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const dependency = (name) => {
        const resource = globalThis.performance
          .getEntriesByType('resource')
          .find((entry) =>
            new globalThis.URL(entry.name).pathname.endsWith(`/node_modules/.vite/deps/${name}.js`)
          );
        if (!resource) throw new Error(`Vite dependency was not loaded: ${name}`);
        return import(resource.name);
      };
      const react = await dependency('react');
      const reactDom = await dependency('react-dom_client');
      const createElement = react.createElement ?? react.default.createElement;
      const createRoot = reactDom.createRoot ?? reactDom.default.createRoot;
      const useState = react.useState ?? react.default.useState;
      const { TheoryQuestionCard } =
        await import('/src/components/practice/TheoryQuestionCard.tsx');
      const { TheoryFeedback } = await import('/src/components/practice/TheoryFeedback.tsx');
      const { TheorySessionComplete } =
        await import('/src/components/practice/TheorySessionComplete.tsx');
      const question = {
        id: 'reference-question',
        topicId: 'topic-react',
        difficulty: 'Junior',
        question:
          'Explain the difference between useEffect and useLayoutEffect in React. When would you choose one over the other?',
      };
      const answer = {
        id: 'answer-reference',
        sessionId: 'session-reference',
        questionId: question.id,
        questionText: question.question,
        userAnswer: 'Effects run after render; layout effects run before paint.',
        aiScore: 8.2,
        aiFeedback:
          'Your answer shows solid understanding. Consider adding more specific edge cases and real-world examples to strengthen your response further.',
        evaluationProvider: null,
        evaluationModel: null,
        evaluationPromptVersion: null,
        status: 'completed',
        failureMessage: null,
        startedAt: null,
        completedAt: null,
        timeTaken: 20,
        createdAt: '2026-11-07T00:00:00Z',
        updatedAt: '2026-11-07T00:00:00Z',
      };
      const preview = globalThis.document.createElement('div');
      preview.id = 'practice-question-preview';
      preview.className = 'px-4 py-6 min-[769px]:px-8';
      const shell = globalThis.document.createElement('div');
      shell.id = 'practice-question-shell';
      const style = globalThis.document.createElement('style');
      style.textContent =
        '#practice-question-shell{margin-left:240px;padding-top:62px;width:calc(100% - 240px)}@media(max-width:768px){#practice-question-shell{margin-left:0;padding-top:62px;width:100%}}@media(max-width:767px){#practice-question-shell{padding-top:73px}}';
      globalThis.document.head.append(style);
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(shell);
      shell.append(preview);

      const PracticeHarness = () => {
        const [answerDraft, setAnswerDraft] = useState('');
        const [submitted, setSubmitted] = useState(false);
        const [isComplete, setIsComplete] = useState(false);
        globalThis.showPracticeCompletion = () => setIsComplete(true);
        if (isComplete) {
          return createElement(TheorySessionComplete, {
            session: {
              id: 'session-reference',
              topicId: 'topic-react',
              mode: 'topic',
              difficulty: 'Junior',
              totalQuestions: 8,
              questionsAnswered: 5,
              avgScore: 8.2,
              status: 'completed',
              startedAt: '2026-11-07T00:00:00Z',
              completedAt: '2026-11-07T00:10:00Z',
              createdAt: '2026-11-07T00:00:00Z',
            },
            answers: [answer],
            onPracticeAgain: () => setIsComplete(false),
            onGoToDashboard: () => {},
          });
        }
        return createElement(
          'main',
          { className: 'mx-auto w-full pt-1' },
          createElement(
            'h1',
            { className: 'mb-4 mt-0 text-[1.35rem] font-bold text-[var(--text-h)]' },
            'Practice Session'
          ),
          createElement(
            'div',
            { className: 'grid gap-5 min-[1025px]:grid-cols-[minmax(0,1fr)_320px]' },
            submitted
              ? createElement(TheoryFeedback, {
                  answer,
                  evaluationError: null,
                  isRefreshing: false,
                  isEnding: false,
                  isCompleting: false,
                  isRestarting: false,
                  canContinue: true,
                  onRetryEvaluation: () => {},
                  onContinue: () => setSubmitted(false),
                  onPracticeSameTopic: () => {},
                  onEnd: () => {},
                })
              : createElement(TheoryQuestionCard, {
                  question,
                  currentQuestion: 1,
                  totalQuestions: 8,
                  elapsedSeconds: 0,
                  answerDraft,
                  isSubmitting: false,
                  isAnswerFrozen: false,
                  submitError: null,
                  submitted: false,
                  onAnswerChange: setAnswerDraft,
                  onSubmit: () => setSubmitted(true),
                  onSkip: () => {},
                  onEnd: () => {},
                }),
            createElement('div', {
              'aria-hidden': 'true',
              className: 'hidden min-[1025px]:block',
            })
          )
        );
      };
      createRoot(preview).render(createElement(PracticeHarness));
    });

    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href, {
      waitUntil: 'networkidle',
    });
    await reference.evaluate(() => {
      globalThis.document.getElementById('scr-app').hidden = false;
      globalThis.showPg('practice');
      globalThis.document.getElementById('pg-practice').classList.add('pg-practice-active');
      globalThis.document.getElementById('q-card').hidden = false;
      globalThis.document.getElementById('fb-card').hidden = true;
    });

    await expect(reference.locator('#q-card')).toBeVisible();

    const referenceQuestion = await reference.locator('#q-card').boundingBox();
    const implementationQuestion = await page
      .locator('#practice-question-preview [aria-labelledby="theory-question-title"]')
      .boundingBox();
    expect(
      Math.abs(implementationQuestion.x - referenceQuestion.x),
      JSON.stringify({ implementationQuestion, referenceQuestion })
    ).toBeLessThanOrEqual(3);
    expect(Math.abs(implementationQuestion.y - referenceQuestion.y)).toBeLessThanOrEqual(5);
    expect(Math.abs(implementationQuestion.width - referenceQuestion.width)).toBeLessThanOrEqual(4);
    expect(
      Math.abs(implementationQuestion.height - referenceQuestion.height),
      JSON.stringify({ implementationQuestion, referenceQuestion })
    ).toBeLessThanOrEqual(8);
    await expect(page.getByRole('progressbar', { name: 'Question progress' })).toHaveAttribute(
      'aria-valuenow',
      '1'
    );

    await page.getByRole('textbox', { name: 'Your answer' }).fill('Effects run after render.');
    await reference.locator('#answer').fill('Effects run after render.');
    await page.getByRole('button', { name: 'Submit answer' }).click();
    await reference.getByRole('button', { name: 'Submit Answer' }).click();
    await expect(page.getByRole('progressbar', { name: 'Answer score' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next Question' })).toBeEnabled();
    await expect(reference.locator('#fb-card')).toBeVisible({ timeout: 5000 });
    const referenceFeedback = await reference.locator('#fb-card').boundingBox();
    const implementationFeedback = await page
      .locator('#practice-question-preview [aria-labelledby="theory-feedback-title"]')
      .boundingBox();
    expect(Math.abs(implementationFeedback.x - referenceFeedback.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(implementationFeedback.width - referenceFeedback.width)).toBeLessThanOrEqual(4);
    expect(
      Math.abs(implementationFeedback.height - referenceFeedback.height),
      JSON.stringify({ implementationFeedback, referenceFeedback })
    ).toBeLessThanOrEqual(12);

    await page.getByRole('button', { name: 'Next Question' }).click();
    await reference.getByRole('button', { name: 'Next Question' }).click();
    await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible();
    await expect(reference.locator('#q-card')).toBeVisible();

    await page.evaluate(() => globalThis.showPracticeCompletion());
    await reference.evaluate(() => {
      globalThis.document.getElementById('q-card').hidden = true;
      globalThis.document.getElementById('fb-card').hidden = true;
      globalThis.document.getElementById('session-complete').hidden = false;
    });
    const referenceComplete = await reference.locator('#session-complete').boundingBox();
    const implementationComplete = await page
      .getByRole('region', { name: 'Session Complete!' })
      .boundingBox();
    expect(Math.abs(implementationComplete.x - referenceComplete.x)).toBeLessThanOrEqual(4);
    expect(
      Math.abs(implementationComplete.y - referenceComplete.y),
      JSON.stringify({ implementationComplete, referenceComplete })
    ).toBeLessThanOrEqual(6);
    expect(Math.abs(implementationComplete.width - referenceComplete.width)).toBeLessThanOrEqual(4);
    expect(
      Math.abs(implementationComplete.height - referenceComplete.height),
      JSON.stringify({ implementationComplete, referenceComplete })
    ).toBeLessThanOrEqual(12);

    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.locator('#practice-question-shell').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(width);
    }
  } finally {
    await browser.close();
  }
});
