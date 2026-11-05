import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CodingSessionHistoryTable } from './CodingSessionHistoryTable';

const createProps = (overrides: Record<string, unknown> = {}) => ({
  hasSessions: false,
  children: null,
  page: 1,
  limit: 20,
  total: 0,
  isLoading: false,
  errorMessage: null,
  problemTitleErrorMessage: null,
  onRetryHistory: vi.fn(),
  onRetryProblemTitles: vi.fn(),
  onPageChange: vi.fn(),
  onStartCoding: vi.fn(),
  ...overrides,
});

describe('CodingSessionHistoryTable', () => {
  it('shows loading status before coding history arrives', () => {
    render(<CodingSessionHistoryTable {...createProps({ isLoading: true })} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading coding session history');
  });

  it('shows retryable errors and lets the learner retry the history request', async () => {
    const user = userEvent.setup();
    const onRetryHistory = vi.fn();
    render(
      <CodingSessionHistoryTable
        {...createProps({ errorMessage: 'Coding history is unavailable.', onRetryHistory })}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Coding history is unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry coding history' }));

    expect(onRetryHistory).toHaveBeenCalledOnce();
  });

  it('offers a path into coding practice when the history is empty', async () => {
    const user = userEvent.setup();
    const onStartCoding = vi.fn();
    render(<CodingSessionHistoryTable {...createProps({ onStartCoding })} />);

    expect(screen.getByRole('heading', { name: 'No coding sessions yet' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start coding practice' }));

    expect(onStartCoding).toHaveBeenCalledOnce();
  });

  it('shows server pagination and reports the visible coding sessions', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <CodingSessionHistoryTable
        {...createProps({
          hasSessions: true,
          children: (
            <tr>
              <td>Session row</td>
            </tr>
          ),
          page: 2,
          total: 45,
          onPageChange,
        })}
      />
    );

    expect(screen.getByRole('table', { name: 'Coding session history' })).toBeVisible();
    expect(screen.getByText('Page 2 of 3')).toBeVisible();
    expect(screen.getByText(/45 coding sessions/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
