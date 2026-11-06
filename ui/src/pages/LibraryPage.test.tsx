import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPdfSource } from '@/core';
import { LibraryPage } from './LibraryPage';

const dependencies = vi.hoisted(() => ({
  sources: vi.fn(),
  getContent: vi.fn(),
  remove: vi.fn(),
  removePdf: vi.fn(),
}));

vi.mock('@/logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/logic')>()),
  usePdfContentReader: () => dependencies.getContent,
  usePdfSourcesReader: dependencies.sources,
  usePdfDeleteCommand: dependencies.remove,
}));
const source: IPdfSource = {
  id: 'pdf-one',
  displayName: 'systems.pdf',
  byteSize: 1024,
  pageCount: 4,
  status: 'ready',
  activeRevision: 1,
  failureCode: null,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};

describe('LibraryPage', () => {
  const objectUrls = {
    createObjectURL: vi.fn(() => 'blob:private-preview'),
    revokeObjectURL: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const URLConstructor = class extends globalThis.URL {};
    Object.assign(URLConstructor, objectUrls);
    vi.stubGlobal('URL', URLConstructor);
    dependencies.sources.mockReturnValue({
      data: [source],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    dependencies.getContent.mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
    dependencies.removePdf.mockResolvedValue({ id: 'pdf-one', status: 'deleted' });
    dependencies.remove.mockReturnValue({ mutateAsync: dependencies.removePdf, isPending: false });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('fetches private bytes for the selected source and revokes the temporary object URL on unmount', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/library?pdfId=pdf-one']}>
        <Routes>
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTitle('Preview: systems.pdf')).toHaveAttribute(
        'src',
        expect.stringContaining('blob:private-preview')
      )
    );
    expect(dependencies.getContent).toHaveBeenCalledWith('pdf-one');
    expect(objectUrls.createObjectURL).toHaveBeenCalledOnce();

    unmount();
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith('blob:private-preview');
  });

  it('starts in the PDF card list and opens the reader only after selecting a file', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/library']}>
        <Routes>
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'My PDFs' })).toBeVisible();
    expect(dependencies.getContent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /systems\.pdf/ }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'PDF reader' })).toBeVisible());
    expect(dependencies.getContent).toHaveBeenCalledWith('pdf-one');
    await user.click(screen.getByRole('button', { name: 'Back to Library' }));
    expect(screen.getByRole('heading', { name: 'My PDFs' })).toBeVisible();
  });

  it('deletes selected files through the PDF command after confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/library']}>
        <Routes>
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: /systems\.pdf/ }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete selected files' }));
    await waitFor(() => expect(dependencies.removePdf).toHaveBeenCalledWith({ pdfId: 'pdf-one' }));
  });

  it('reports content retrieval errors with a retry action', async () => {
    dependencies.getContent.mockRejectedValue(new Error('PDF is unavailable'));
    render(
      <MemoryRouter initialEntries={['/library?pdfId=pdf-one']}>
        <Routes>
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('PDF is unavailable');
    expect(screen.getByRole('button', { name: 'Retry preview' })).toBeInTheDocument();
  });

  it('opens a requested page from a question citation', async () => {
    render(
      <MemoryRouter initialEntries={['/library?pdfId=pdf-one&page=3']}>
        <Routes>
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Page 3 / 4')).toBeVisible());
  });
});
