import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPdfSource } from '@/core';
import { LibraryPage } from './LibraryPage';

const dependencies = vi.hoisted(() => ({
  sources: vi.fn(),
  getContent: vi.fn(),
}));

vi.mock('@/logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/logic')>()),
  usePdfContentReader: () => dependencies.getContent,
  usePdfSourcesReader: dependencies.sources,
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
    vi.stubGlobal('URL', objectUrls);
    dependencies.sources.mockReturnValue({
      data: [source],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    dependencies.getContent.mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
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

    await waitFor(() =>
      expect(screen.getByRole('spinbutton', { name: 'Current page' })).toHaveValue(3)
    );
  });
});
