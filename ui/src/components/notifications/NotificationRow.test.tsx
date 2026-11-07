import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { INotification } from '@/core';
import { NotificationRow } from './NotificationRow';

const notification: INotification = {
  id: 'notice-one',
  category: 'reminder',
  title: 'Practice today',
  body: 'Take a few minutes to practice today.',
  link: '/practice',
  readAt: null,
  createdAt: '2026-11-05T06:00:00.000Z',
};

const renderRow = (overrides: Partial<Parameters<typeof NotificationRow>[0]> = {}) => {
  const props = {
    notification,
    theme: 'dark' as const,
    isBusy: false,
    onMarkRead: vi.fn(),
    onDelete: vi.fn(),
    onOpenNotification: vi.fn(),
    ...overrides,
  };
  return {
    props,
    ...render(
      <MemoryRouter>
        <ul>
          <NotificationRow {...props} />
        </ul>
      </MemoryRouter>
    ),
  };
};

describe('NotificationRow', () => {
  it('opens internal notification routes through the layout callback', async () => {
    const user = userEvent.setup();
    const { props } = renderRow();

    await user.click(screen.getByRole('link', { name: /Practice today/ }));

    expect(props.onOpenNotification).toHaveBeenCalledWith('/practice');
  });

  it.each(['https://outside.example/path', '//outside.example/path', 'javascript:alert(1)', ''])(
    'does not create a clickable link for an unsafe destination (%s)',
    (link) => {
      renderRow({ notification: { ...notification, link } });

      expect(screen.queryByRole('link', { name: /Practice today/ })).not.toBeInTheDocument();
      expect(screen.getByText('Practice today')).toBeVisible();
    }
  );

  it('shows the read timestamp and omits the mark-as-read action for a read notice', () => {
    renderRow({ notification: { ...notification, readAt: '2026-11-05T07:00:00.000Z' } });

    expect(
      screen.getByText(
        new Date(notification.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
      )
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark Practice today as read' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Practice today' })).toBeEnabled();
  });

  it('disables actions while a notification mutation is pending', () => {
    renderRow({ isBusy: true });

    expect(screen.getByRole('button', { name: 'Mark Practice today as read' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Practice today' })).toBeDisabled();
  });

  it('calls the matching read and delete handlers with the notification id', async () => {
    const user = userEvent.setup();
    const { props } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Mark Practice today as read' }));
    await user.click(screen.getByRole('button', { name: 'Delete Practice today' }));

    expect(props.onMarkRead).toHaveBeenCalledWith('notice-one');
    expect(props.onDelete).toHaveBeenCalledWith('notice-one');
  });

  it('uses the neutral category label when the category is blank', () => {
    renderRow({ notification: { ...notification, category: '' } });

    expect(screen.getByText('Update')).toBeVisible();
  });
});
