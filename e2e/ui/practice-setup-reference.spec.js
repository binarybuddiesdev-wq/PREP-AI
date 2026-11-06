import { chromium, expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const textBox = (locator) =>
  locator.evaluate((element) => {
    const range = globalThis.document.createRange();
    range.selectNodeContents(element);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });

test('Practice setup matches the prototype layout at desktop, tablet, and mobile widths', async () => {
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
      const { PracticeSetup } = await import('/src/components/practice/PracticeSetup.tsx');
      const useState = react.useState ?? react.default.useState;
      const ready = {
        totalQuestions: 10,
        isPremium: false,
        dailySessions: { used: 0, limit: 3 },
        isDailySessionsLoading: false,
        isDailySessionsFetching: false,
        dailySessionsError: null,
        onRetryDailySessions: () => {},
        topics: [
          'React',
          'TypeScript',
          'HTML',
          'CSS',
          'Node.js',
          'ExpressJS',
          'NestJS',
          'MongoDB',
          'System Design',
        ].map((name) => ({
          id: `topic-${name.toLowerCase().replaceAll(' ', '-')}`,
          name,
          slug: name.toLowerCase().replaceAll(' ', '-'),
          category: 'practice',
          icon: null,
        })),
        weakAreas: [
          ['MongoDB', 4.5],
          ['System Design', 6.2],
          ['ExpressJS', 6.8],
        ].map(([topicName, avgScore]) => ({
          topicId: `weak-${topicName.toLowerCase().replaceAll(' ', '-')}`,
          topicName,
          avgScore,
          sessionsCount: 3,
          lastPracticed: '2026-11-05T00:00:00Z',
        })),
        pdfSources: [
          ['pdf-react', 'React Fundamentals.pdf', 142],
          ['pdf-nest', 'NestJS Guide.pdf', 98],
          ['pdf-typescript', 'TypeScript Handbook.pdf', 210],
          ['pdf-design', 'System Design Patterns.pdf', 176],
          ['pdf-dsa', 'DSA Concepts.pdf', 88],
        ].map(([id, displayName, pageCount]) => ({
          id,
          displayName,
          pageCount: Number(pageCount),
          status: 'ready',
        })),
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
      };
      globalThis.document.querySelector('#root').hidden = true;
      const shell = globalThis.document.createElement('div');
      shell.id = 'practice-shell';
      const preview = globalThis.document.createElement('div');
      preview.id = 'practice-preview';
      preview.className = 'px-4 py-6 min-[769px]:px-8';
      const shellStyle = globalThis.document.createElement('style');
      shellStyle.textContent =
        '#practice-shell{margin-left:240px;padding-top:62px;width:calc(100% - 240px)}@media(max-width:768px){#practice-shell{margin-left:0;padding-top:62px;width:100%}}@media(max-width:767px){#practice-shell{padding-top:73px}}';
      globalThis.document.head.append(shellStyle);
      globalThis.document.body.append(shell);
      shell.append(preview);
      const PracticeHarness = () => {
        const [mode, setMode] = useState('topic');
        const [topicId, setTopicId] = useState('topic-react');
        const [difficulty, setDifficulty] = useState('Junior');
        const [selectedPdfIds, setSelectedPdfIds] = useState(['pdf-react', 'pdf-nest']);
        return createElement(PracticeSetup, {
          ...ready,
          mode,
          topicId,
          difficulty,
          selectedPdfIds,
          onModeChange: setMode,
          onTopicChange: setTopicId,
          onDifficultyChange: setDifficulty,
          onPdfSelectionChange: setSelectedPdfIds,
        });
      };
      createRoot(preview).render(createElement(PracticeHarness));
    });

    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href, {
      waitUntil: 'networkidle',
    });
    await reference.locator('#scr-app').evaluate((element) => {
      element.hidden = false;
    });
    await reference.evaluate(() => globalThis.showPg('practice'));

    const referenceTitle = reference.locator('#pg-practice .pg-title');
    const implementationTitle = page.getByRole('heading', { name: 'Practice Session' });
    const referenceTitleBox = await textBox(referenceTitle);
    const implementationTitleBox = await textBox(implementationTitle);
    expect(Math.abs(implementationTitleBox.x - referenceTitleBox.x)).toBeLessThanOrEqual(3);
    expect(
      Math.abs(implementationTitleBox.y - referenceTitleBox.y),
      JSON.stringify({ implementationTitleBox, referenceTitleBox })
    ).toBeLessThanOrEqual(3);

    const referenceTopicLabel = await textBox(
      reference.locator('#config-topic .filter-lbl').nth(0)
    );
    const implementationTopicLabel = await textBox(page.getByText('Topics', { exact: true }));
    const referenceDifficultyLabel = await textBox(
      reference.locator('#config-topic .filter-lbl').nth(1)
    );
    const implementationDifficultyLabel = await textBox(
      page.locator('#practice-preview main').getByText('Difficulty', { exact: true }).first()
    );
    expect(Math.abs(implementationTopicLabel.y - referenceTopicLabel.y)).toBeLessThanOrEqual(3);
    expect(
      Math.abs(implementationDifficultyLabel.y - referenceDifficultyLabel.y)
    ).toBeLessThanOrEqual(3);

    const referenceStartCard = await reference.locator('#start-card').boundingBox();
    const implementationStartCard = await page
      .locator('#practice-preview main > section')
      .nth(2)
      .boundingBox();
    expect(Math.abs(implementationStartCard.x - referenceStartCard.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(implementationStartCard.width - referenceStartCard.width)).toBeLessThanOrEqual(
      3
    );
    expect(
      Math.abs(implementationStartCard.height - referenceStartCard.height),
      JSON.stringify({ implementationStartCard, referenceStartCard })
    ).toBeLessThanOrEqual(36);

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await reference.setViewportSize({ width, height: 900 });
      const referenceModes = reference.locator('#practice-modes');
      const implementationModes = page.getByRole('region', { name: 'Practice mode' });
      const referenceColumns = await referenceModes.evaluate(
        (element) => globalThis.getComputedStyle(element).gridTemplateColumns.split(' ').length
      );
      const implementationColumns = await implementationModes.evaluate(
        (element) => globalThis.getComputedStyle(element).gridTemplateColumns.split(' ').length
      );
      expect(implementationColumns, `mode columns at ${width}px`).toBe(referenceColumns);
      const referenceFirstMode = await referenceModes
        .locator('.practice-mode-card')
        .first()
        .boundingBox();
      const implementationFirstMode = await implementationModes
        .getByRole('button')
        .first()
        .boundingBox();
      if (width !== 390) {
        expect(
          Math.abs(implementationFirstMode.height - referenceFirstMode.height),
          `first mode card height at ${width}px: ${JSON.stringify({ implementationFirstMode, referenceFirstMode })}`
        ).toBeLessThanOrEqual(5);
      }
      const referenceConfig = await reference.locator('#config-topic').boundingBox();
      const implementationConfig = await page
        .locator('#practice-preview main > section')
        .nth(1)
        .boundingBox();
      expect(
        Math.abs(implementationConfig.height - referenceConfig.height),
        `topic config height at ${width}px: ${JSON.stringify({ implementationConfig, referenceConfig })}`
      ).toBeLessThanOrEqual(8);
      await expect(page.getByRole('button', { name: 'Topic Practice' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(page.getByRole('button', { name: 'Start practice' })).toBeEnabled();
      await expect
        .poll(() => page.locator('#practice-preview').evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(width);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await reference.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Weak Areas' }).click();
    await reference.evaluate(() => globalThis.selectMode('weak'));
    await expect(page.getByRole('button', { name: 'Weak Areas' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('progressbar', { name: 'MongoDB average score' })).toHaveAttribute(
      'aria-valuenow',
      '45'
    );
    await expect(
      page.getByText('Topics below 70% score will be included in this session.')
    ).toBeVisible();

    await page.getByRole('button', { name: 'PDF Study' }).click();
    await reference.evaluate(() => globalThis.selectMode('pdf'));
    await expect(page.getByRole('button', { name: 'PDF Study' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('checkbox', { name: /React Fundamentals.pdf/ })).toBeChecked();
    await expect(page.getByText('2 of 5 selected')).toBeVisible();
    await page.getByRole('checkbox', { name: /TypeScript Handbook.pdf/ }).check();
    await expect(page.getByText('3 of 5 selected')).toBeVisible();
  } finally {
    await browser.close();
  }
});
