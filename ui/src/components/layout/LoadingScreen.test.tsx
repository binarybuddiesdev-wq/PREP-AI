import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoadingScreen } from './LoadingScreen';

describe('LoadingScreen', () => {
  it('announces embedded loading without creating a second full-screen page', () => {
    render(<LoadingScreen label="Loading settings..." layout="embedded" />);

    const loadingStatus = screen.getByRole('status');
    expect(loadingStatus).toHaveTextContent('Loading settings...');
    expect(loadingStatus).not.toHaveClass('min-h-screen');
    expect(loadingStatus.firstElementChild).not.toHaveClass('text-zinc-400');
  });

  it('keeps the existing full-screen layout as the default', () => {
    render(<LoadingScreen label="Loading your setup..." />);

    expect(screen.getByRole('status')).toHaveClass('min-h-screen');
  });
});
