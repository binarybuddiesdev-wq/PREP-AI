import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { IPdfSource } from '@/core';
import { PdfDocumentManager } from './PdfDocumentManager';

const source = (id: string, status: IPdfSource['status']): IPdfSource => ({
  id,
  displayName: `${id}.pdf`,
  byteSize: 2_048,
  pageCount: 6,
  status,
  activeRevision: status === 'ready' ? 1 : 0,
  failureCode: status === 'failed' ? 'invalid_pdf' : null,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
});

const renderManager = (overrides: Partial<ComponentProps<typeof PdfDocumentManager>> = {}) =>
  render(
    <MemoryRouter>
      <PdfDocumentManager
        sources={[source('ready', 'ready'), source('failed', 'failed'), source('queued', 'queued')]}
        isLoading={false}
        listError={null}
        isUploading={false}
        uploadFileName={null}
        uploadProgress={0}
        uploadError={null}
        validationError={null}
        reindexingId={null}
        deletingId={null}
        confirmingDeleteId={null}
        actionError={null}
        onFilesSelected={vi.fn()}
        onUpload={vi.fn()}
        onRetryUpload={vi.fn()}
        onRetryList={vi.fn()}
        onReindex={vi.fn()}
        onRequestDelete={vi.fn()}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>
  );

describe('PdfDocumentManager', () => {
  it('uses theme-aware surfaces and text for upload and document lists', () => {
    renderManager();

    const uploadPanel = screen.getByRole('region', { name: 'Add a study document' });
    const documentList = screen.getByRole('list', { name: 'Uploaded documents' });

    expect(uploadPanel).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]');
    expect(
      screen.getByText('Upload searchable PDFs to read and use in a study session.')
    ).toHaveClass('text-[var(--dim)]');
    expect(documentList).toHaveClass(
      'divide-[var(--border)]',
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByText('ready.pdf')).toHaveClass('text-[var(--text)]');
  });

  it('uses theme-aware surfaces and text for empty and loading document states', () => {
    const { rerender } = renderManager({ sources: [] });

    expect(screen.getByText('No documents yet').parentElement).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByText('Your uploaded PDFs will appear here.')).toHaveClass(
      'text-[var(--dim)]'
    );

    rerender(
      <MemoryRouter>
        <PdfDocumentManager
          sources={[]}
          isLoading
          listError={null}
          isUploading={false}
          uploadFileName={null}
          uploadProgress={0}
          uploadError={null}
          validationError={null}
          reindexingId={null}
          deletingId={null}
          confirmingDeleteId={null}
          actionError={null}
          onFilesSelected={vi.fn()}
          onUpload={vi.fn()}
          onRetryUpload={vi.fn()}
          onRetryList={vi.fn()}
          onReindex={vi.fn()}
          onRequestDelete={vi.fn()}
          onCancelDelete={vi.fn()}
          onConfirmDelete={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toHaveClass('border-[var(--border)]', 'text-[var(--dim)]');
  });

  it('shows upload progress and real document status details', () => {
    renderManager({ isUploading: true, uploadFileName: 'notes.pdf', uploadProgress: 45 });

    expect(screen.getByRole('progressbar', { name: 'Uploading notes.pdf' })).toHaveAttribute(
      'aria-valuenow',
      '45'
    );
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Indexing')).toBeInTheDocument();
    expect(screen.getByText(/This PDF could not be indexed/)).toBeInTheDocument();
    expect(screen.getAllByText('2 KB · 6 pages')).toHaveLength(3);
  });

  it('offers preview only for ready sources and reindex only for ready or failed sources', () => {
    renderManager();

    expect(screen.getByRole('link', { name: 'Open ready.pdf in Library' })).toHaveAttribute(
      'href',
      '/library?pdfId=ready'
    );
    expect(screen.getAllByRole('button', { name: 'Reindex' })).toHaveLength(2);
  });

  it('passes selected PDFs from the picker and supports an inline delete confirmation', async () => {
    const user = userEvent.setup();
    const onFilesSelected = vi.fn();
    const onConfirmDelete = vi.fn();
    renderManager({
      onFilesSelected,
      confirmingDeleteId: 'ready',
      onConfirmDelete,
    });

    const file = new File(['%PDF-1.7'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Choose a PDF file'), { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith(file);

    await user.click(screen.getByRole('button', { name: 'Delete PDF' }));
    expect(onConfirmDelete).toHaveBeenCalledOnce();
    expect(screen.getByText('Delete ready.pdf?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete PDF' })).toHaveClass(
      'bg-[var(--red-bg)]',
      'text-[var(--danger-strong)]'
    );
  });

  it('keeps failed upload retryable and exposes list recovery', async () => {
    const user = userEvent.setup();
    const onRetryUpload = vi.fn();
    const onRetryList = vi.fn();
    renderManager({
      uploadFileName: 'notes.pdf',
      uploadError: 'Upload interrupted.',
      listError: 'Could not load your documents.',
      onRetryUpload,
      onRetryList,
    });

    await user.click(screen.getByRole('button', { name: 'Retry upload' }));
    await user.click(screen.getByRole('button', { name: 'Retry documents' }));
    expect(onRetryUpload).toHaveBeenCalledOnce();
    expect(onRetryList).toHaveBeenCalledOnce();
  });
});
