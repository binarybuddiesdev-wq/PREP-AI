import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConfigurationErrorScreen } from './ConfigurationErrorScreen';

describe('ConfigurationErrorScreen', () => {
  it('keeps Clerk-only guidance off unrelated error screens', () => {
    render(
      <ConfigurationErrorScreen
        title="Something went wrong"
        description="Reload and try again."
        category="Unexpected error"
      />
    );

    expect(screen.queryByText(/Clerk Secret Key/)).not.toBeInTheDocument();
    expect(screen.getByText('What you can do')).toBeInTheDocument();
  });
});
