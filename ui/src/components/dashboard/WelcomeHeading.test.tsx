import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WelcomeHeading } from './WelcomeHeading';

describe('WelcomeHeading', () => {
  it.each(['Asha', 'Teja', 'Account'])('personalizes the dashboard greeting for %s', (name) => {
    render(<WelcomeHeading name={name} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`Welcome, ${name}`);
    expect(screen.getByText("You're signed in. This is your dashboard.")).toBeVisible();
  });
});
