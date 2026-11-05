import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LandingHero } from './LandingHero';

describe('LandingHero', () => {
  it('shows the product promise and a truthful practice-flow preview without fabricated statistics', () => {
    render(
      <MemoryRouter>
        <LandingHero signUpTo="/sign-up" />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /the smarter way to.*prepare for interviews/i
    );
    expect(
      screen.getByText('Topic-focused questions. Clear feedback. Progress you can review.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start practicing/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
    expect(screen.getByRole('group', { name: 'PrepAI practice flow' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'PrepAI capabilities' })).toBeInTheDocument();
    expect(screen.getByText('Choose topics and difficulty')).toBeInTheDocument();
    expect(
      screen.getByText('Questions match the topic and difficulty you chose.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Practice with questions focused on the topic and difficulty you choose, or study from your own documents\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/generated specifically for your target role/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText('500+')).not.toBeInTheDocument();
    expect(screen.queryByText('12k+')).not.toBeInTheDocument();
    expect(screen.queryByText('4.9')).not.toBeInTheDocument();
    expect(screen.queryByText(/Score: 8\.5\/10/)).not.toBeInTheDocument();
  });
});
