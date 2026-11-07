import { chromium, expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('PDF manager header, PDF row, and upload area match the reference settings screen', async () => {
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
      globalThis.showPg('settings');
    });
    await reference.getByRole('button', { name: 'Documents' }).click();
    const referenceHeading = await reference.locator('#set-docs h2').boundingBox();
    const bounds = await reference.locator('#set-docs').boundingBox();

    await reactPage.evaluate(
      async ({ bounds, referenceHeading }) => {
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
        const { PdfDocumentManager } = await import('/src/components/pdf/PdfDocumentManager.tsx');
        const preview = globalThis.document.createElement('main');
        preview.id = 'pdf-manager-reference-preview';
        preview.style.cssText = `position:fixed;left:${bounds.x + 33}px;top:${referenceHeading.y - 32}px;width:${bounds.width - 66}px`;
        globalThis.document.querySelector('#root').hidden = true;
        globalThis.document.body.append(preview);
        const sources = [
          {
            id: 'pdf-1',
            displayName: 'React Fundamentals.pdf',
            byteSize: 2.4 * 1024 * 1024,
            pageCount: 142,
            status: 'ready',
            activeRevision: 1,
            failureCode: null,
            createdAt: '2026-11-06T00:00:00.000Z',
            updatedAt: '2026-11-06T00:00:00.000Z',
          },
        ];
        const Harness = () => {
          const [selected, setSelected] = useState(null);
          const [confirming, setConfirming] = useState(null);
          return createElement(PdfDocumentManager, {
            sources,
            isLoading: false,
            listError: null,
            isUploading: false,
            uploadFileName: selected,
            uploadProgress: 0,
            uploadError: null,
            validationError: null,
            reindexingId: null,
            deletingId: null,
            confirmingDeleteId: confirming,
            actionError: null,
            onFilesSelected: (file) => setSelected(file.name),
            onUpload: () => {
              globalThis.window.__pdfUploadClicked = true;
            },
            onRetryUpload: () => {},
            onRetryList: () => {},
            onReindex: () => {},
            onRequestDelete: setConfirming,
            onCancelDelete: () => setConfirming(null),
            onConfirmDelete: () => {
              globalThis.window.__pdfDeleteConfirmed = true;
              setConfirming(null);
            },
          });
        };
        createRoot(preview).render(createElement(MemoryRouter, null, createElement(Harness)));
      },
      { bounds, referenceHeading }
    );

    const preview = reactPage.locator('#pdf-manager-reference-preview');
    const referenceRows = reference.locator('#pdf-list-docs .pdf-card');
    await reference.evaluate(() => {
      const list = globalThis.document.querySelector('#pdf-list-docs');
      const card = globalThis.document.createElement('div');
      card.className = 'pdf-card';
      card.innerHTML =
        '<div class="pdf-card-info"><div class="pdf-card-icon">PDF</div><div><div class="pdf-card-name">React Fundamentals.pdf</div><div class="pdf-card-size">2.4 MB &bull; 142 pages</div></div></div><div style="display:flex;align-items:center"><div class="toggle-sw on"></div><div class="pdf-delete">×</div></div>';
      list.append(card);
    });
    const reactHeading = await preview
      .getByRole('heading', { name: 'Documents', level: 1 })
      .boundingBox();
    expect(
      Math.abs(reactHeading.y - referenceHeading.y),
      JSON.stringify({ reactHeading, referenceHeading })
    ).toBeLessThanOrEqual(2);
    const refCard = await referenceRows.first().boundingBox();
    const reactCard = await preview
      .getByRole('list', { name: 'Uploaded documents' })
      .getByRole('listitem')
      .boundingBox();
    expect(
      Math.abs(reactCard.y - refCard.y),
      JSON.stringify({ reactCard, refCard })
    ).toBeLessThanOrEqual(8);
    expect(Math.abs(reactCard.height - refCard.height)).toBeLessThanOrEqual(8);
    const refDrop = await reference.locator('#set-docs .pdf-drop').boundingBox();
    const reactDrop = await preview
      .locator('input[aria-label="Choose a PDF file"]')
      .locator('xpath=..')
      .boundingBox();
    expect(
      Math.abs(reactDrop.y - refDrop.y),
      JSON.stringify({ reactDrop, refDrop, reactCard, refCard })
    ).toBeLessThanOrEqual(12);
    expect(Math.abs(reactDrop.height - refDrop.height)).toBeLessThanOrEqual(12);
    await preview.locator('input[aria-label="Choose a PDF file"]').setInputFiles({
      name: 'New notes.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7'),
    });
    await preview.getByRole('button', { name: 'Upload PDF' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__pdfUploadClicked))
      .toBe(true);
    await preview.getByRole('button', { name: 'Delete React Fundamentals.pdf' }).click();
    await preview.getByRole('button', { name: 'Delete PDF' }).click();
    await expect
      .poll(() => reactPage.evaluate(() => globalThis.window.__pdfDeleteConfirmed))
      .toBe(true);
    expect(await reactPage.evaluate(() => globalThis.document.documentElement.scrollWidth)).toBe(
      1440
    );
  } finally {
    await browser.close();
  }
});
