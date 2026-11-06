import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LandingHero } from './LandingHero';

describe('LandingHero', () => {
  it('shows the product promise and a truthful practice-session preview without fabricated statistics', () => {
    render(
      <MemoryRouter>
        <LandingHero signUpTo="/sign-up" />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /the smarter way to.*prepare for interviews/i
    );
    expect(
      screen.getByText('AI-crafted questions. Real-time feedback. Track every session.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start practicing/i })).toHaveAttribute(
      'href',
      '/sign-up'
    );
    expect(screen.getByRole('group', { name: 'PrepAI practice session' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'PrepAI capabilities' })).toBeInTheDocument();
    expect(screen.getByText('Topics & level')).toBeInTheDocument();
    expect(screen.getByText('Answer feedback')).toBeInTheDocument();
    expect(screen.getByText('Session history')).toBeInTheDocument();
    expect(screen.getByText('Questions match your chosen topic.')).toBeInTheDocument();
    expect(
      screen.getByText('A question based on your topic and target difficulty appears here.')
    ).toBeInTheDocument();
    expect(screen.getByText('Your answer has been submitted.')).toBeInTheDocument();
    expect(
      screen.getByText('Score and written feedback explain what to improve next and why.')
    ).toBeInTheDocument();
    expect(screen.getByText('_', { selector: '.landing-terminal__cursor' })).toBeInTheDocument();
    expect(screen.getByText(/prepai start <topic> <level>/i)).toBeInTheDocument();
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
