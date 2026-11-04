import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LandingShowcase } from './LandingShowcase';

describe('LandingShowcase', () => {
  it('tilts the feedback preview toward the pointer and resets when the pointer leaves', async () => {
    const user = userEvent.setup();
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    render(<LandingShowcase />);
    const preview = screen.getByRole('group', { name: 'Example practice question and feedback' });

    await user.pointer({ target: preview, coords: { clientX: 200, clientY: 0 } });
    expect(preview).toHaveStyle({ '--landing-rotate-x': '10deg', '--landing-rotate-y': '-3deg' });

    await user.unhover(preview);
    expect(preview).toHaveStyle({ '--landing-rotate-x': '6deg', '--landing-rotate-y': '-8deg' });

    bounds.mockRestore();
  });
});
