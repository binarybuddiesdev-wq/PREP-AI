import { chromium, expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Library PDF cards and select/open controls match the reference screen', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const reactPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reference = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await reactPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await reference.goto(pathToFileURL(resolve('prepai-ui.html')).href);
    await reference.evaluate(() => {
      globalThis.go('app');
      globalThis.showPg('library');
    });
    const refTitle = await reference.locator('#pg-library > .pg-title').boundingBox();
    const refGrid = await reference.locator('#lib-grid').boundingBox();
    const sources = [
      ['DSA PRACTISE.pdf', 2.4, 42],
      ['React Fundamentals.pdf', 2.4, 142],
      ['NestJS Guide.pdf', 1.8, 98],
      ['TypeScript Handbook.pdf', 3.1, 210],
      ['System Design Patterns.pdf', 2.7, 176],
      ['DSA Concepts.pdf', 1.5, 88],
    ].map(([displayName, megabytes, pageCount], index) => ({
      id: `pdf-${index + 1}`,
      displayName,
      byteSize: megabytes * 1024 * 1024,
      pageCount,
      status: 'ready',
      activeRevision: 1,
      failureCode: null,
      createdAt: '2026-11-06T00:00:00.000Z',
      updatedAt: '2026-11-06T00:00:00.000Z',
    }));
    await reactPage.evaluate(
      async ({ refTitle, refGrid, sources }) => {
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
        const useState = react.useState ?? react.default?.useState;
        const reactDom = await loadDependency('react-dom_client');
        const createRoot = reactDom.createRoot ?? reactDom.default?.createRoot;
        const reactRouter = await loadDependency('react-router');
        const MemoryRouter = reactRouter.MemoryRouter ?? reactRouter.default?.MemoryRouter;
        const { PdfLibrary } = await import('/src/components/pdf/PdfLibrary.tsx');
        const preview = globalThis.document.createElement('main');
        preview.id = 'library-reference-preview';
        preview.style.cssText = `position:absolute;left:${refTitle.x}px;top:${refTitle.y - 32}px;width:${refGrid.width}px`;
        globalThis.document.querySelector('#root').hidden = true;
        globalThis.document.body.append(preview);
        const Harness = () => {
          const [selectedId, setSelectedId] = useState(null);
          return createElement(PdfLibrary, {
            sources,
            selectedSource: sources.find((source) => source.id === selectedId) ?? null,
            isLoading: false,
            listError: null,
            contentUrl: selectedId ? 'blob:private-preview' : null,
            contentLoading: false,
            contentError: null,
            onSelectSource: setSelectedId,
            onBackToList: () => setSelectedId(null),
            onRetryList: () => {},
            onRetryContent: () => {},
            onDeleteSources: async (ids) => {
              globalThis.window.__deletedPdfs = ids;
              return true;
            },
          });
        };
        createRoot(preview).render(createElement(MemoryRouter, null, createElement(Harness)));
      },
      { refTitle, refGrid, sources }
    );

    const preview = reactPage.locator('#library-reference-preview');
    const referenceCards = reference.locator('#lib-grid .code-full-card');
    const reactCards = preview.locator('[aria-label="PDF documents"] li > button');
    await expect(referenceCards).toHaveCount(6);
    await expect(reactCards).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      const expected = await referenceCards.nth(index).boundingBox();
      const actual = await reactCards.nth(index).boundingBox();
      expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(4);
      expect(
        Math.abs(actual.y - expected.y),
        JSON.stringify({ index, actual, expected })
      ).toBeLessThanOrEqual(6);
      expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(4);
      expect(
        Math.abs(actual.height - expected.height),
        JSON.stringify({ index, actual, expected })
      ).toBeLessThanOrEqual(8);
    }

    await reference.getByRole('button', { name: 'Select' }).click();
    await preview.getByRole('button', { name: 'Select' }).click();
    await reactCards.nth(0).click();
    await preview.getByRole('button', { name: 'Delete' }).click();
    await reactPage.getByRole('button', { name: 'Delete selected files' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__deletedPdfs))
      .toEqual(['pdf-1']);

    await reference.evaluate(() => globalThis.openPdf(1));
    await preview.getByRole('button', { name: /React Fundamentals\.pdf/ }).click();
    await expect(preview.getByRole('region', { name: 'PDF reader' })).toBeVisible();
    const referenceReader = await reference.locator('.lib-pdf-viewer').boundingBox();
    const reactReader = await preview.getByRole('region', { name: 'PDF reader' }).boundingBox();
    expect(
      Math.abs(reactReader.y - referenceReader.y),
      JSON.stringify({ reactReader, referenceReader })
    ).toBeLessThanOrEqual(6);
    expect(
      Math.abs(reactReader.height - referenceReader.height),
      JSON.stringify({ reactReader, referenceReader })
    ).toBeLessThanOrEqual(8);
    await preview.getByRole('button', { name: 'Next page' }).click();
    await preview.getByRole('button', { name: 'Zoom in' }).click();
    await expect(preview.getByText('Page 2 / 142')).toBeVisible();
    await expect(preview.getByTitle('Preview: React Fundamentals.pdf')).toHaveAttribute(
      'src',
      'blob:private-preview#page=2&zoom=125'
    );

    await reactPage.setViewportSize({ width: 390, height: 844 });
    await preview.evaluate((element) => {
      element.style.left = '0px';
      element.style.top = '0px';
      element.style.width = '390px';
    });
    expect(
      await reactPage.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth >
          globalThis.document.documentElement.clientWidth
      )
    ).toBe(false);
  } finally {
    await browser.close();
  }
});
