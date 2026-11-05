import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';
import { AuthPageShell } from './AuthPageShell';

describe('AuthPageShell', () => {
  it('presents Clerk content in the PrepAI account access layout', () => {
    renderWithProviders(
      <AuthPageShell brandTo="/">
        <form aria-label="Sign in form">
          <button type="submit">Continue</button>
        </form>
      </AuthPageShell>
    );

    expect(screen.getByRole('main', { name: 'Account access' })).toHaveClass(
      'bg-[var(--bg)]',
      'text-[var(--text)]'
    );
    expect(screen.getByRole('region', { name: 'PrepAI authentication' })).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    const brandLink = screen.getByRole('link', { name: /PrepAI/ });
    expect(brandLink).toHaveAttribute('href', '/');
    expect(brandLink).toHaveClass('text-[var(--text-h)]');
    expect(screen.getByRole('form', { name: 'Sign in form' })).toBeInTheDocument();
  });
});
