import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StudyChatComposer } from './StudyChatComposer';

const createProps = (overrides = {}) => ({
  draft: '',
  isDisabled: false,
  isSending: false,
  maxLength: 4000,
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  ...overrides,
});

describe('StudyChatComposer', () => {
  it('announces character count and submits trimmed text', async () => {
    const user = userEvent.setup();
    const props = createProps({ draft: '  Explain closures.  ' });
    render(<StudyChatComposer {...props} />);

    expect(screen.getByText('21 / 4,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(props.onSubmit).toHaveBeenCalledWith('Explain closures.');
  });

  it('does not submit whitespace-only or over-limit input', async () => {
    const user = userEvent.setup();
    const props = createProps({ draft: '   ' });
    const { rerender } = render(<StudyChatComposer {...props} />);

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(props.onSubmit).not.toHaveBeenCalled();

    rerender(<StudyChatComposer {...createProps({ draft: 'x'.repeat(4001) })} />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('allows submitting a one-character message', async () => {
    const user = userEvent.setup();
    const props = createProps({ draft: 'x' });
    render(<StudyChatComposer {...props} />);

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeEnabled();
    await user.click(sendButton);

    expect(props.onSubmit).toHaveBeenCalledWith('x');
  });

  it('allows submitting a message at the maximum length', async () => {
    const user = userEvent.setup();
    const props = createProps({ draft: 'x'.repeat(4000) });
    render(<StudyChatComposer {...props} />);

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    expect(sendButton).toBeEnabled();
    await user.click(sendButton);

    expect(props.onSubmit).toHaveBeenCalledWith('x'.repeat(4000));
  });

  it('disables the composer and announces the sending state', () => {
    render(<StudyChatComposer {...createProps({ draft: 'Question', isSending: true })} />);
    expect(screen.getByRole('textbox', { name: 'Message PrepAI Assistant' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled();
  });
});
