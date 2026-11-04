import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsDocumentsPage } from './SettingsDocumentsPage';

const hooks = vi.hoisted(() => ({
  sources: vi.fn(),
  upload: { mutate: vi.fn(), isPending: false, error: null as Error | null },
  reindex: {
    mutate: vi.fn(),
    isPending: false,
    variables: undefined as { pdfId: string } | undefined,
    error: null as Error | null,
  },
  remove: {
    mutate: vi.fn(),
    isPending: false,
    variables: undefined as { pdfId: string } | undefined,
    error: null as Error | null,
  },
}));

vi.mock('@/logic', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/logic')>()),
  usePdfSourcesReader: hooks.sources,
  usePdfUploadCommand: () => hooks.upload,
  usePdfReindexCommand: () => hooks.reindex,
  usePdfDeleteCommand: () => hooks.remove,
}));

const renderPage = () => render(<SettingsDocumentsPage />, { wrapper: MemoryRouter });

describe('SettingsDocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.sources.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    hooks.upload.isPending = false;
    hooks.upload.error = null;
    hooks.reindex.isPending = false;
    hooks.reindex.variables = undefined;
    hooks.reindex.error = null;
    hooks.remove.isPending = false;
    hooks.remove.variables = undefined;
    hooks.remove.error = null;
  });

  it('rejects an invalid PDF signature before making an upload request', async () => {
    renderPage();
    const file = new File(['not a PDF'], 'notes.pdf', { type: 'application/pdf' });

    fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('valid PDF signature');
    expect(hooks.upload.mutate).not.toHaveBeenCalled();
  });

  it('reuses the same idempotency key when retrying the same failed upload', async () => {
    const user = userEvent.setup();
    renderPage();
    const file = new File(['%PDF-1.7'], 'systems.pdf', { type: 'application/pdf' });

    fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [file] } });
    await user.click(await screen.findByRole('button', { name: 'Upload PDF' }));
    await waitFor(() => expect(hooks.upload.mutate).toHaveBeenCalledOnce());
    const firstVariables = hooks.upload.mutate.mock.calls[0]?.[0] as {
      idempotencyKey: string;
      file: File;
    };
    const options = hooks.upload.mutate.mock.calls[0]?.[1] as unknown as {
      onError: (error: Error) => void;
    };
    expect(firstVariables.file).toBe(file);
    options.onError(new Error('Network unavailable'));

    await user.click(await screen.findByRole('button', { name: 'Retry upload' }));
    expect(hooks.upload.mutate).toHaveBeenCalledTimes(2);
    expect(hooks.upload.mutate.mock.calls[1]?.[0]).toMatchObject({
      file,
      idempotencyKey: firstVariables.idempotencyKey,
    });
  });
});
