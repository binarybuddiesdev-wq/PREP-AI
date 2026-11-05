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
      screen.getByRole('heading', { name: /feedback that explains what to improve/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/AI score and written feedback for each answer/i)).toBeInTheDocument();
    expect(
      screen.getByText('See an AI-generated score and written feedback on your answer.')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /four steps, every session/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /practice that keeps your next step clear/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Set a topic and target difficulty for each practice session/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/PrepAI records your elapsed time/i)).toBeInTheDocument();
    expect(screen.queryByText(/Timed, typed/i)).not.toBeInTheDocument();
    expect(screen.queryByText('4.2→8.3')).not.toBeInTheDocument();
    expect(screen.queryByText('31→84%')).not.toBeInTheDocument();
    expect(screen.queryByText(/exact phrase to add/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /get started free/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
  });
});
