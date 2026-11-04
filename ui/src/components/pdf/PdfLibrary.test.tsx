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

    expect(screen.getByRole('heading', { name: 'PDF Library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /first\.pdf/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.queryByRole('button', { name: 'queued.pdf' })).not.toBeInTheDocument();
    expect(screen.getByTitle('Preview: first.pdf')).toHaveAttribute(
      'src',
      'blob:http://localhost/pdf-preview#page=1&zoom=100'
    );
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
    expect(screen.getByLabelText('Current page')).toHaveValue(2);
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
    expect(screen.getByRole('link', { name: 'Manage documents' })).toHaveAttribute(
      'href',
      '/settings/documents'
    );
  });
});
