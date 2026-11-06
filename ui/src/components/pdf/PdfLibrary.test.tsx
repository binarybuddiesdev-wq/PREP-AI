import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { IPdfSource } from '@/core';
import { PdfLibrary } from './PdfLibrary';

const pdf = (id: string): IPdfSource => ({
  id,
  displayName: `${id}.pdf`,
  byteSize: 1024,
  pageCount: 8,
  status: 'ready',
  activeRevision: 1,
  failureCode: null,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
});

describe('PdfLibrary', () => {
  it('shows only ready sources and opens the selected private preview', () => {
    render(
      <MemoryRouter>
        <PdfLibrary
          sources={[pdf('first'), { ...pdf('queued'), status: 'queued' }]}
          selectedSource={pdf('first')}
          isLoading={false}
          listError={null}
          contentUrl="blob:http://localhost/pdf-preview"
          contentLoading={false}
          contentError={null}
          onSelectSource={vi.fn()}
          onRetryList={vi.fn()}
          onRetryContent={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'PDF reader' })).toHaveClass('bg-[var(--card)]');
    expect(screen.queryByRole('button', { name: /first\.pdf/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'queued.pdf' })).not.toBeInTheDocument();
    expect(screen.getByTitle('Preview: first.pdf')).toHaveAttribute(
      'src',
      'blob:http://localhost/pdf-preview#page=1&zoom=100'
    );
  });

  it('matches the reference PDF list and opens a separate reader view', async () => {
    const user = userEvent.setup();
    const onSelectSource = vi.fn();
    render(
      <MemoryRouter>
        <PdfLibrary
          sources={[pdf('first'), pdf('second')]}
          selectedSource={null}
          isLoading={false}
          listError={null}
          contentUrl={null}
          contentLoading={false}
          contentError={null}
          onSelectSource={onSelectSource}
          onRetryList={vi.fn()}
          onRetryContent={vi.fn()}
          onDeleteSources={vi.fn()}
          isDeleting={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Read and manage your uploaded PDF documents')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'My PDFs' })).toBeVisible();
    expect(screen.getByRole('button', { name: /first\.pdf/ })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'PDF reader' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /first\.pdf/ }));
    expect(onSelectSource).toHaveBeenCalledWith('first');
  });

  it('confirms and deletes selected PDFs through the supplied command', async () => {
    const user = userEvent.setup();
    const onDeleteSources = vi.fn(async () => true);
    render(
      <MemoryRouter>
        <PdfLibrary
          sources={[pdf('first'), pdf('second')]}
          selectedSource={null}
          isLoading={false}
          listError={null}
          contentUrl={null}
          contentLoading={false}
          contentError={null}
          onSelectSource={vi.fn()}
          onRetryList={vi.fn()}
          onRetryContent={vi.fn()}
          onDeleteSources={onDeleteSources}
          isDeleting={false}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: /first\.pdf/ }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('delete this file');
    await user.click(screen.getByRole('button', { name: 'Delete selected files' }));
    expect(onDeleteSources).toHaveBeenCalledWith(['first']);
  });

  it('provides page and zoom controls around the browser PDF viewer', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PdfLibrary
          sources={[pdf('first')]}
          selectedSource={pdf('first')}
          isLoading={false}
          listError={null}
          contentUrl="blob:pdf"
          contentLoading={false}
          contentError={null}
          onSelectSource={vi.fn()}
          onRetryList={vi.fn()}
          onRetryContent={vi.fn()}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('Page 2 / 8')).toBeVisible();
    expect(screen.getByTitle('Preview: first.pdf')).toHaveAttribute(
      'src',
      'blob:pdf#page=2&zoom=125'
    );
  });

  it('explains the empty state and links to document management', () => {
    render(
      <MemoryRouter>
        <PdfLibrary
          sources={[]}
          selectedSource={null}
          isLoading={false}
          listError={null}
          contentUrl={null}
          contentLoading={false}
          contentError={null}
          onSelectSource={vi.fn()}
          onRetryList={vi.fn()}
          onRetryContent={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Your Library is empty')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Documents' })).toHaveAttribute(
      'href',
      '/settings/documents'
    );
  });
});
