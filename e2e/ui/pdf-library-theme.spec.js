import { chromium, expect, test } from '@playwright/test';

test('renders PDF reader surfaces and errors in both themes without mobile overflow', async () => {
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
      const router = await loadViteDependency('react-router');
      const { PdfLibrary } = await import('/src/components/pdf/PdfLibrary.tsx');
      const source = {
        id: 'pdf-source-1',
        displayName: 'Interview handbook.pdf',
        byteSize: 2048,
        pageCount: 8,
        status: 'ready',
        activeRevision: 1,
        failureCode: null,
        createdAt: '2026-11-05T00:00:00.000Z',
        updatedAt: '2026-11-05T00:00:00.000Z',
      };
      const preview = globalThis.document.createElement('div');
      preview.id = 'pdf-library-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      const content = globalThis.document.createElement('div');
      content.className = 'px-4 py-6 sm:px-6 lg:px-8';
      preview.append(content);
      createRoot(content).render(
        createElement(
          router.MemoryRouter,
          { initialEntries: ['/library'] },
          createElement(PdfLibrary, {
            sources: [source],
            selectedSource: source,
            isLoading: false,
            listError: null,
            contentUrl: null,
            contentLoading: false,
            contentError: 'Private preview could not be loaded.',
            onSelectSource: () => {},
            onRetryList: () => {},
            onRetryContent: () => {},
          })
        )
      );
    });

    const reader = page.getByRole('region', { name: 'PDF reader' });
    await expect(reader).toBeVisible();
    await expect
      .poll(() =>
        reader.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(24, 24, 27)');
    await expect
      .poll(() =>
        page
          .getByText('Private preview could not be loaded.', { exact: true })
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(253, 164, 175)');

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        reader.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(255, 255, 255)');
    await expect
      .poll(() =>
        page
          .getByText('Private preview could not be loaded.', { exact: true })
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .toBe('rgb(190, 18, 60)');
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() => page.locator('#pdf-library-preview').evaluate((element) => element.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
