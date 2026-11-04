import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LandingSections } from './LandingSections';

describe('LandingSections', () => {
  it('shows the reference feature sections and a sign-up call to action', () => {
    render(
      <MemoryRouter>
        <LandingSections signUpTo="/sign-up" />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /feedback that reads like a senior engineer wrote it/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /four steps, every session/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /scores that actually move/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get started free/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
  });
});
