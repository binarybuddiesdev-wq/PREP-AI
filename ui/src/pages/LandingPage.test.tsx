import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';

import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('shows the public product page, auth links, and persisted theme control', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /the smarter way to.*prepare for interviews/i
    );

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    expect(window.localStorage.getItem('prepai-theme')).toBe('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('restores the saved light theme', () => {
    window.localStorage.setItem('prepai-theme', 'light');
    renderWithProviders(<LandingPage />);

    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
