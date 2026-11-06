import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('coding catalogue cards and filters match the reference at desktop size', async () => {
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
      globalThis.showPg('coding');
    });
    const referencePage = reference.locator('#pg-coding');
    const referencePageBox = await referencePage.boundingBox();
    const referenceHeaderBoxes = await reference
      .locator('#pg-coding > .pg-title, #pg-coding > .pg-sub')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          y: element.getBoundingClientRect().y,
          height: element.getBoundingClientRect().height,
        }))
      );
    const referenceCard = reference.locator('#code-full-list .code-full-card').first();
    await expect(referenceCard).toBeVisible();
    const referenceCardBox = await referenceCard.boundingBox();
    const referenceStatsBox = await reference.locator('#coding-stats-bar').boundingBox();
    const referenceTopicFilterBox = await reference
      .locator('#code-list-view .filter-row button')
      .first()
      .boundingBox();
    const referenceFilterBox = await reference
      .locator('#code-list-view > div')
      .first()
      .boundingBox();

    await page.evaluate(
      async ({ referencePageBox }) => {
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
        const { CodingProblemCatalog } =
          await import('/src/components/coding/CodingProblemCatalog.tsx');
        const { CodingStatsBar } = await import('/src/components/coding/CodingStatsBar.tsx');
        globalThis.document.querySelector('#root').hidden = true;
        const preview = globalThis.document.createElement('main');
        preview.id = 'coding-reference-preview';
        preview.style.cssText = `position:fixed;left:${referencePageBox.x + 32}px;top:${referencePageBox.y}px;width:${referencePageBox.width - 64}px`;
        globalThis.document.body.append(preview);
        const stats = {
          solved: 0,
          dailySolved: { used: 0, limit: 5 },
          dailyReviews: { used: 0, limit: 3 },
          streakDays: 0,
        };
        const problem = {
          id: 'two-sum',
          title: 'Two Sum',
          slug: 'two-sum',
          description:
            'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
          difficulty: 'Easy',
          topic: 'Arrays',
          isSolved: false,
        };
        const problems = [
          problem,
          ...[
            'Stacks',
            'Hash Maps',
            'Binary Search',
            'Linked Lists',
            'Trees',
            'Graphs',
            'Dynamic Programming',
            'Two Pointers',
            'Backtracking',
            'Sliding Window',
          ].map((topic, index) => ({
            id: `topic-${index}`,
            title: `Sample ${topic}`,
            slug: `sample-${index}`,
            description: `Practice a representative ${topic} problem.`,
            difficulty: 'Medium',
            topic,
            isSolved: false,
          })),
        ];
        createRoot(preview).render(
          createElement(
            'div',
            { className: 'mx-auto w-full max-w-6xl space-y-5' },
            createElement(
              'header',
              null,
              createElement(
                'h1',
                { className: 'mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]' },
                'Coding Questions'
              ),
              createElement(
                'p',
                { className: 'text-[0.9rem] text-[var(--dim)]' },
                'Practice algorithm and data structure problems with AI feedback'
              )
            ),
            createElement(CodingStatsBar, {
              stats,
              isLoading: false,
              isRetrying: false,
              errorMessage: null,
              onRetry: () => {},
            }),
            createElement(CodingProblemCatalog, {
              problems,
              selectedTopic: null,
              selectedDifficulty: null,
              onSelectTopic: () => {},
              onSelectDifficulty: () => {},
              onSelectProblem: () => {},
            })
          )
        );
      },
      { referencePageBox }
    );

    const card = page.getByRole('button', { name: /Two Sum/ });
    const stats = page.getByRole('group', { name: 'Coding statistics' });
    const topicFilter = page
      .getByRole('group', { name: 'Filter by topic' })
      .getByRole('button', { name: 'All' });
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    const statsBox = await stats.boundingBox();
    const topicFilterBox = await topicFilter.boundingBox();
    const reactFilterBox = await page
      .locator('#coding-reference-preview section[aria-label="Coding problem catalogue"] > div')
      .boundingBox();
    const reactHeaderBoxes = await page
      .locator('#coding-reference-preview header')
      .evaluate((element) =>
        [...element.children].map((child) => ({
          y: child.getBoundingClientRect().y,
          height: child.getBoundingClientRect().height,
        }))
      );
    expect(Math.abs(cardBox.width - referenceCardBox.width)).toBeLessThanOrEqual(4);
    expect(
      Math.abs(cardBox.height - referenceCardBox.height),
      JSON.stringify({ cardBox, referenceCardBox })
    ).toBeLessThanOrEqual(2);
    expect(Math.abs(statsBox.height - referenceStatsBox.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(topicFilterBox.height - referenceTopicFilterBox.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(topicFilterBox.width - referenceTopicFilterBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(reactHeaderBoxes[0].y - referenceHeaderBoxes[0].y)).toBeLessThanOrEqual(4);
    expect(Math.abs(reactFilterBox.height - referenceFilterBox.height)).toBeLessThanOrEqual(4);
    expect(
      Math.abs(cardBox.y - referenceCardBox.y),
      JSON.stringify({
        cardBox,
        referenceCardBox,
        statsBox,
        referenceStatsBox,
        topicFilterBox,
        referenceTopicFilterBox,
      })
    ).toBeLessThanOrEqual(5);
  } finally {
    await browser.close();
  }
});
