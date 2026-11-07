import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsDocumentsPanel } from './SettingsDocumentsPanel';

describe('SettingsDocumentsPanel', () => {
  it('opens the existing documents screen', async () => {
    const user = userEvent.setup();
    const onOpenDocuments = vi.fn();
    render(<SettingsDocumentsPanel onOpenDocuments={onOpenDocuments} />);

    expect(screen.getByText(/Upload PDF documents to use as question sources/i)).toBeVisible();
    expect(screen.getByText('Open the document manager to browse and upload files')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Upload or manage PDFs' }));

    expect(onOpenDocuments).toHaveBeenCalledOnce();
  });
});
