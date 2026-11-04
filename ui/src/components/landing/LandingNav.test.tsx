import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { LandingNav } from './LandingNav';

describe('LandingNav', () => {
  it('toggles the theme and closes the mobile navigation after choosing a destination', async () => {
    const user = userEvent.setup();
    const onToggleTheme = vi.fn();

    render(
      <MemoryRouter>
        <LandingNav
          homeTo="/"
          signInTo="/sign-in"
          signUpTo="/sign-up"
          theme="dark"
          onToggleTheme={onToggleTheme}
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(onToggleTheme).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(screen.getByRole('link', { name: 'How It Works' }));
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
