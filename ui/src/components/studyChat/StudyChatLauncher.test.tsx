import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StudyChatLauncher } from './StudyChatLauncher';

describe('StudyChatLauncher', () => {
  it('exposes an accessible toggle with its open state', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<StudyChatLauncher isOpen={false} onToggle={onToggle} />);
    const launcher = screen.getByRole('button', { name: 'Open PrepAI Assistant' });

    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await user.click(launcher);
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<StudyChatLauncher isOpen onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Close PrepAI Assistant' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
