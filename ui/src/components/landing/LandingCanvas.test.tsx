import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LandingCanvas } from './LandingCanvas';

describe('LandingCanvas', () => {
  it('keeps ambient decoration hidden from assistive technology and tolerates unavailable canvas rendering', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<LandingCanvas theme="dark" />);

    expect(screen.getByRole('presentation', { hidden: true })).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    getContext.mockRestore();
  });
});
