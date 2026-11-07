import { chromium, expect, test } from '@playwright/test';

test('renders Settings documents with readable surfaces in both themes', async () => {
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ channel: 'chrome' });
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
      const { PdfDocumentManager } = await import('/src/components/pdf/PdfDocumentManager.tsx');
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
      const preview = globalThis.document.createElement('main');
      preview.id = 'settings-documents-preview';
      globalThis.document.querySelector('#root').hidden = true;
      globalThis.document.body.append(preview);
      createRoot(preview).render(
        createElement(
          router.MemoryRouter,
          null,
          createElement(PdfDocumentManager, {
            sources: [source],
            isLoading: false,
            listError: null,
            isUploading: false,
            uploadFileName: null,
            uploadProgress: 0,
            uploadError: null,
            validationError: null,
            reindexingId: null,
            deletingId: null,
            confirmingDeleteId: null,
            actionError: null,
            onFilesSelected: () => {},
            onUpload: () => {},
            onRetryUpload: () => {},
            onRetryList: () => {},
            onReindex: () => {},
            onRequestDelete: () => {},
            onCancelDelete: () => {},
            onConfirmDelete: () => {},
          })
        )
      );
    });

    const uploadPanel = page.getByRole('region', { name: 'Add a study document' });
    const documentList = page.getByRole('list', { name: 'Uploaded documents' });
    await expect(uploadPanel).toBeVisible();
    await expect(documentList).toBeVisible();
    const darkUploadBorder = await uploadPanel
      .locator('div')
      .first()
      .evaluate((element) => globalThis.getComputedStyle(element).borderColor);
    const darkListSurface = await documentList
      .locator('li')
      .first()
      .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
    const darkDescription = await page
      .getByText('Upload PDF documents to use as question sources. Drag files or click to browse.')
      .evaluate((element) => globalThis.getComputedStyle(element).color);

    await page.locator('html').evaluate((element) => (element.dataset.theme = 'light'));
    await expect
      .poll(() =>
        uploadPanel
          .locator('div')
          .first()
          .evaluate((element) => globalThis.getComputedStyle(element).borderColor)
      )
      .not.toBe(darkUploadBorder);
    await expect
      .poll(() =>
        documentList
          .locator('li')
          .first()
          .evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)
      )
      .not.toBe(darkListSurface);
    await expect
      .poll(() =>
        page
          .getByText(
            'Upload PDF documents to use as question sources. Drag files or click to browse.'
          )
          .evaluate((element) => globalThis.getComputedStyle(element).color)
      )
      .not.toBe(darkDescription);
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.locator('#settings-documents-preview').evaluate((element) => element.scrollWidth)
        )
        .toBeLessThanOrEqual(viewport.width);
    }
    expect(browserErrors).toEqual([]);
  } finally {
    await browser.close();
  }
});
