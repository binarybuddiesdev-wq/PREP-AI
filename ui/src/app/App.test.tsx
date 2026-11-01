import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App configuration', () => {
  it('shows Clerk setup instructions when the publishable key is invalid', () => {
    render(<App />);

    expect(screen.getByText('Setup required')).toBeInTheDocument();
    expect(screen.getByText('Fix the Clerk configuration')).toBeInTheDocument();
    expect(screen.getByText('Clerk Dashboard → API Keys')).toBeInTheDocument();
  });
});
