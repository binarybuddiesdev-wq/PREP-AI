import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LandingHero } from './LandingHero';

describe('LandingHero', () => {
  it('shows the product promise, sign-up action, and example practice output', () => {
    render(
      <MemoryRouter>
        <LandingHero signUpTo="/sign-up" />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /the smarter way to.*prepare for interviews/i
    );
    expect(screen.getByRole('link', { name: /start practicing/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
    expect(
      screen.getByRole('group', { name: 'Example PrepAI practice session' })
    ).toBeInTheDocument();
  });
});
