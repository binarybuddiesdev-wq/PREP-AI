import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsDocumentsPanel } from './SettingsDocumentsPanel';

describe('SettingsDocumentsPanel', () => {
  it('opens the existing documents screen', async () => {
    const user = userEvent.setup();
    const onOpenDocuments = vi.fn();
    render(<SettingsDocumentsPanel onOpenDocuments={onOpenDocuments} />);

    await user.click(screen.getByRole('button', { name: 'Manage documents' }));

    expect(onOpenDocuments).toHaveBeenCalledOnce();
  });
});
