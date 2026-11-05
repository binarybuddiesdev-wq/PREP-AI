import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { IStudyChatMessage } from '@/core';
import { StudyChatMessage } from './StudyChatMessage';

describe('StudyChatMessage', () => {
  it('labels the speaker and renders returned text literally with line breaks', () => {
    const message: IStudyChatMessage = {
      role: 'assistant',
      content: '<img src=x onerror=alert(1)>\nSecond line',
      createdAt: '2026-11-05T10:00:00.000Z',
    };
    const { container } = render(<StudyChatMessage message={message} />);

    expect(screen.getByText('PrepAI Assistant')).toBeInTheDocument();
    const content = screen
      .getByRole('article', { name: 'PrepAI Assistant message' })
      .querySelector('p');
    expect(content).toHaveClass('whitespace-pre-wrap');
    expect(content?.textContent).toBe(message.content);
    expect(container.querySelector('img')).toBeNull();
  });

  it('identifies a learner message accessibly', () => {
    render(
      <StudyChatMessage
        message={{
          role: 'user',
          content: 'Can you help me prepare?',
          createdAt: '2026-11-05T10:00:00.000Z',
        }}
      />
    );
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Can you help me prepare?')).toBeInTheDocument();
  });
});
