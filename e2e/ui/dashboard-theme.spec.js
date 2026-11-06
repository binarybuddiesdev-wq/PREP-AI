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

test('renders dashboard surfaces and status colors in both themes on mobile and desktop', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
      const MemoryRouter = router.MemoryRouter ?? router.default?.MemoryRouter;
      if (typeof createRoot !== 'function') {
        throw new Error(`React DOM client exports: ${Object.keys(reactDom).join(', ')}`);
      }
      const { DashboardOverview } = await import('/src/components/dashboard/DashboardOverview.tsx');
      const ready = {
        isPending: false,
        isError: false,
        isFetching: false,
        error: null,
        onRetry: () => {},
      };
      const failed = {
        ...ready,
        isError: true,
        error: new Error('Coding history is unavailable'),
      };
      const summary = {
        metrics: {
          completedSessions: 3,
          questionsAnswered: 14,
          averageScore: 7.5,
          problemsSolved: 2,
          currentStreak: 2,
        },
        week: [],
        recentSessions: [
          {
            id: 'session-react',
            topicName: 'React Hooks',
            startedAt: '2026-11-05T07:00:00.000Z',
            status: 'completed',
            questionsAnswered: 5,
            totalQuestions: 5,
            averageScore: 8.5,
          },
        ],
        scoreTrend: [
          { date: '2026-11-05', avgScore: 7.5 },
          { date: '2026-11-06', avgScore: 8 },
        ],
        suggestions: [
          {
            topicId: 'topic-node',
            topicName: 'Node.js',
            avgScore: 5.5,
            sessionsCount: 2,
            lastPracticed: '2026-11-05T07:00:00.000Z',
          },
        ],
        setupChecklist: [],
      };
      const practiceTopics = [
        {
          id: 'topic-react',
          name: 'React',
          slug: 'react',
          category: 'practice',
          icon: null,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ];
      const codingProblems = [
        {
          id: 'two-sum',
          title: 'Two Sum',
          slug: 'two-sum',
          description: 'Find two values that add up to the target.',
          difficulty: 'Easy',
          topic: 'Arrays',
          isSolved: false,
        },
      ];
      const preview = globalThis.document.createElement('div');
      preview.id = 'dashboard-preview';
      const responsiveShell = globalThis.document.createElement('style');
      responsiveShell.textContent =
        '#dashboard-preview{margin-left:240px;padding-top:62px;width:calc(100% - 240px)}@media(max-width:767px){#dashboard-preview{margin-left:0;padding-top:73px;width:100%}}';
      globalThis.document.head.append(responsiveShell);
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const content = globalThis.document.createElement('div');
      content.className = 'px-4 py-6 sm:px-6 lg:px-8';
      preview.append(content);
      const dashboardRoot = createRoot(content);
      const renderDashboard = (codingStatus) =>
        dashboardRoot.render(
          createElement(
            MemoryRouter,
            { initialEntries: ['/dashboard'] },
            createElement(DashboardOverview, {
              name: 'Asha',
              summary,
              practiceTopics,
              codingProblems,
              theoryStatus: ready,
              codingStatus,
              codingProblemsStatus: ready,
              scoreTrendStatus: ready,
              weakAreasStatus: ready,
              practiceTopicsStatus: ready,
              settingsStatus: ready,
              onOpenSession: () => {},
            })
          )
        );
      renderDashboard(failed);

      const { AppShell } = await import('/src/components/layout/AppShell.tsx');
      const { BrandLink } = await import('/src/components/layout/BrandLink.tsx');
      const icons = await loadViteDependency('lucide-react');
      const shellPreview = globalThis.document.createElement('div');
      shellPreview.id = 'dashboard-shell-preview';
      shellPreview.style.display = 'none';
      globalThis.document.body.append(shellPreview);
      createRoot(shellPreview).render(
        createElement(
          MemoryRouter,
          null,
          createElement(AppShell, {
            activeRoute: '/dashboard',
            brand: createElement(BrandLink, { to: '/dashboard', size: 'small' }),
            collapseIcon: createElement(icons.PanelLeftClose, { size: 16 }),
            expandIcon: createElement(icons.PanelLeftOpen, { size: 16 }),
            headerLeadingActions: null,
            headerActions: null,
            mobileCloseIcon: createElement(icons.X, { size: 20 }),
            mobileMenuIcon: createElement(icons.Menu, { size: 20 }),
            navigation: [
              {
                label: 'Main',
                items: [
                  {
                    label: 'Dashboard',
                    route: '/dashboard',
                    icon: createElement(icons.LayoutDashboard, { size: 18 }),
                  },
                ],
              },
            ],
            onNavigate: () => {},
            onThemeToggle: () => {},
            pageTitle: 'Dashboard',
            theme: 'dark',
            themeIcon: createElement(icons.Sun, { size: 17 }),
            userEmail: 'asha@example.com',
            userMenu: createElement(
              'button',
              { type: 'button', 'aria-label': 'Account menu' },
              'A'
            ),
            userName: 'Asha',
            children: createElement(DashboardOverview, {
              name: 'Asha',
              summary,
              practiceTopics,
              codingProblems,
              theoryStatus: ready,
              codingStatus: ready,
              codingProblemsStatus: ready,
              scoreTrendStatus: ready,
              weakAreasStatus: ready,
              practiceTopicsStatus: ready,
              settingsStatus: ready,
              onOpenSession: () => {},
            }),
          })
        )
      );
    });

    const dashboardPreview = page.locator('#dashboard-preview');
    const metricLabel = dashboardPreview.getByText('Sessions Completed', { exact: true });
    await expect(metricLabel).toBeVisible();
    const scoreTrendChart = dashboardPreview.getByRole('img', {
      name: /Score trend for the last 2 sessions/,
    });
    await expect(scoreTrendChart).toBeVisible();
    await expect(scoreTrendChart.locator('[data-score-trend-point]')).toHaveCount(2);
    await expect(dashboardPreview.getByText('Last 2 sessions', { exact: true })).toBeVisible();
    await expect(
      dashboardPreview.getByText('Based on your weak areas, we recommend:')
    ).toBeVisible();
    const recentSessionsTable = dashboardPreview.getByRole('table', { name: 'Recent Sessions' });
    await expect(recentSessionsTable.getByRole('columnheader')).toHaveText([
      'Topic',
      'Date',
      'Score',
      'Status',
    ]);
    await expect(recentSessionsTable.getByRole('cell', { name: 'Completed' })).toBeVisible();
    await expect(dashboardPreview.getByRole('link', { name: 'Practice Node.js' })).toHaveAttribute(
      'href',
      '/practice?topicId=topic-node'
    );
    await expect(dashboardPreview.getByRole('link', { name: 'Practice React' })).toHaveAttribute(
      'href',
      '/practice?topicId=topic-react'
    );
    await expect(dashboardPreview.getByRole('link', { name: /Try Two Sum/ })).toHaveAttribute(
      'href',
      '/coding/two-sum'
    );

    const card = metricLabel.locator('..');
    await expect
      .poll(() => card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() =>
        dashboardPreview
          .getByText('Coding history is unavailable', { exact: true })
          .first()
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(253, 164, 175)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() => card.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        dashboardPreview
          .getByText('Coding history is unavailable', { exact: true })
          .first()
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(190, 18, 60)');

    await page.locator('html').evaluate((element) => {
      element.dataset.theme = 'dark';
    });
    await page.locator('#dashboard-preview').evaluate((element) => {
      element.hidden = true;
    });
    await page.locator('#dashboard-shell-preview').evaluate((element) => {
      element.style.display = 'block';
    });
    const referencePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await referencePage.goto(pathToFileURL(resolve('prepai-ui.html')).href, {
      waitUntil: 'networkidle',
    });
    await referencePage.locator('#scr-app').evaluate((element) => {
      element.hidden = false;
    });
    const referenceKpis = referencePage.locator('#pg-dashboard .kpi-row');
    const implementationKpis = page.locator(
      '#dashboard-shell-preview [aria-label="Practice summary"]'
    );
    const referenceKpiBox = await referenceKpis.boundingBox();
    const implementationKpiBox = await implementationKpis.boundingBox();
    const referenceTitle = await textBox(referencePage.locator('#pg-dashboard .pg-title'));
    const implementationTitle = await textBox(
      page.locator('#dashboard-shell-preview').getByRole('heading', { level: 1 })
    );
    expect(Math.abs(implementationKpiBox.x - referenceKpiBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(implementationKpiBox.width - referenceKpiBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(implementationTitle.x - referenceTitle.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(implementationTitle.y - referenceTitle.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(implementationKpiBox.y - referenceKpiBox.y)).toBeLessThanOrEqual(2);
    const referenceFirstDesktopKpi = await referencePage
      .locator('#pg-dashboard .kpi')
      .first()
      .boundingBox();
    const implementationFirstDesktopKpi = await implementationKpis
      .locator('article')
      .first()
      .boundingBox();
    expect(
      Math.abs(implementationFirstDesktopKpi.height - referenceFirstDesktopKpi.height),
      JSON.stringify({ referenceFirstDesktopKpi, implementationFirstDesktopKpi })
    ).toBeLessThanOrEqual(4);
    const referenceContentGrid = await referencePage
      .locator('#pg-dashboard .dash-grid')
      .boundingBox();
    const implementationContentGrid = await page
      .locator('#dashboard-shell-preview main > section')
      .filter({ has: page.getByRole('heading', { name: 'Recent Sessions' }) })
      .boundingBox();
    expect(
      Math.abs(implementationContentGrid.y - referenceContentGrid.y),
      JSON.stringify({ implementationContentGrid, referenceContentGrid })
    ).toBeLessThanOrEqual(6);

    await referencePage.setViewportSize({ width: 390, height: 844 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        referencePage
          .locator('.mn')
          .evaluate((element) => globalThis.getComputedStyle(element).marginLeft)
      )
      .toBe('0px');
    const referenceFirstKpi = referencePage.locator('#pg-dashboard .kpi').first();
    const implementationFirstKpi = implementationKpis.locator('article').first();
    const referenceFirstKpiBox = await referenceFirstKpi.boundingBox();
    const implementationFirstKpiBox = await implementationFirstKpi.boundingBox();
    const referenceMobileTitle = await textBox(referencePage.locator('#pg-dashboard .pg-title'));
    const implementationMobileTitle = await textBox(
      page.locator('#dashboard-shell-preview').getByRole('heading', { level: 1 })
    );
    const referenceMobileKpiRow = await referenceKpis.boundingBox();
    const implementationMobileKpiRow = await implementationKpis.boundingBox();
    const referenceColumns = await referenceKpis.evaluate(
      (element) => globalThis.getComputedStyle(element).gridTemplateColumns.split(' ').length
    );
    const implementationColumns = await implementationKpis.evaluate(
      (element) => globalThis.getComputedStyle(element).gridTemplateColumns.split(' ').length
    );
    expect(implementationColumns).toBe(referenceColumns);
    expect(Math.abs(implementationFirstKpiBox.x - referenceFirstKpiBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(implementationMobileTitle.y - referenceMobileTitle.y)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(implementationMobileKpiRow.y - referenceMobileKpiRow.y),
      JSON.stringify({
        implementationMobileKpiRow,
        referenceMobileKpiRow,
        implementationMobileTitle,
        referenceMobileTitle,
        implementationSubtitle: await textBox(
          page.locator('#dashboard-shell-preview main > header > p')
        ),
        referenceSubtitle: await textBox(referencePage.locator('#dashboard-sub')),
      })
    ).toBeLessThanOrEqual(2);
    expect(Math.abs(implementationMobileKpiRow.x - referenceMobileKpiRow.x)).toBeLessThanOrEqual(2);
    expect(
      Math.abs(implementationFirstKpiBox.height - referenceFirstKpiBox.height),
      JSON.stringify({ referenceFirstKpiBox, implementationFirstKpiBox })
    ).toBeLessThanOrEqual(4);
    await referencePage.close();

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() => page.locator('#dashboard-preview').evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
      await expect
        .poll(() =>
          page.locator('#dashboard-shell-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
  } finally {
    await browser.close();
  }
});
