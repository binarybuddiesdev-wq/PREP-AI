import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('history rows and expanded answers match the reference while remaining interactive', async () => {
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
    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href);
    await reference.evaluate(() => {
      globalThis.go('app');
      globalThis.showPg('history');
    });
    const referenceRow = reference.locator('#hist-body > tr[role="button"]').first();
    await expect(referenceRow).toBeVisible();

    await page.evaluate(
      async (referenceCard) => {
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
        const reactModule = await loadDependency('react');
        const createElement = reactModule.createElement ?? reactModule.default?.createElement;
        const reactDomModule = await loadDependency('react-dom_client');
        const createRoot = reactDomModule.createRoot ?? reactDomModule.default?.createRoot;
        const { SessionHistoryTable } =
          await import('/src/components/history/SessionHistoryTable.tsx');
        const { SessionHistoryRow } = await import('/src/components/history/SessionHistoryRow.tsx');
        globalThis.document.querySelector('#root').hidden = true;
        const preview = globalThis.document.createElement('main');
        preview.id = 'history-react-preview';
        preview.style.cssText = `position:fixed;left:${referenceCard.x}px;top:0;width:${referenceCard.width}px`;
        globalThis.document.body.append(preview);
        const session = {
          id: 'history-session',
          topicId: 'React Hooks',
          mode: 'topic',
          difficulty: 'Mid',
          totalQuestions: 8,
          questionsAnswered: 8,
          avgScore: 8.5,
          status: 'completed',
          startedAt: '2026-06-24T10:00:00.000Z',
          completedAt: '2026-06-24T10:18:00.000Z',
          createdAt: '2026-06-24T10:00:00.000Z',
        };
        const detail = {
          ...session,
          answers: [
            {
              id: 'answer-one',
              sessionId: session.id,
              questionId: 'question-one',
              questionText: 'What is the virtual DOM?',
              userAnswer:
                'The virtual DOM is a lightweight JS representation of the actual DOM. React uses it to batch updates and minimize expensive DOM operations by diffing the virtual tree before committing changes.',
              aiScore: 8.5,
              aiFeedback:
                'Clear and accurate. Could mention the diffing algorithm for extra depth.',
              evaluationProvider: null,
              evaluationModel: null,
              evaluationPromptVersion: null,
              status: 'completed',
              failureMessage: null,
              startedAt: null,
              completedAt: null,
              timeTaken: 32,
              createdAt: session.startedAt,
              updatedAt: session.startedAt,
            },
          ],
        };
        const root = createRoot(preview);
        let expanded = false;
        const renderHistory = () =>
          root.render(
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
                session,
                isExpanded: expanded,
                detail,
                isDetailLoading: false,
                detailError: null,
                onToggle: () => {
                  expanded = !expanded;
                  renderHistory();
                },
                onRetry: () => {},
              })
            )
          );
        renderHistory();
      },
      await reference.locator('.hist-card').boundingBox()
    );

    const referenceRowBox = await referenceRow.boundingBox();
    const implementationRow = page.locator('#history-react-preview tbody > tr').first();
    await expect(implementationRow).toBeVisible();
    const implementationRowBox = await implementationRow.boundingBox();
    expect(
      Math.abs(implementationRowBox.height - referenceRowBox.height),
      JSON.stringify({ implementationRowBox, referenceRowBox })
    ).toBeLessThanOrEqual(5);
    await expect(
      page.locator('#history-react-preview tbody > tr').first().locator('td').nth(1)
    ).toContainText('Practice');

    await referenceRow.click();
    await page.locator('#history-react-preview button[aria-label^="Show details"]').click();
    await expect(reference.locator('#exp-0')).toBeVisible();
    await expect(page.getByRole('region', { name: /session answers/i })).toBeVisible();
    await expect(
      page.getByText('Clear and accurate. Could mention the diffing algorithm for extra depth.')
    ).toBeVisible();
    const referenceAnswer = await reference.locator('#exp-0 .qa-blk').first().boundingBox();
    const implementationAnswer = await page
      .locator('#history-react-preview article')
      .first()
      .boundingBox();
    expect(
      Math.abs(implementationAnswer.height - referenceAnswer.height),
      JSON.stringify({ implementationAnswer, referenceAnswer })
    ).toBeLessThanOrEqual(3);
  } finally {
    await browser.close();
  }
});
