import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ICodingSession } from '@/core';
import { ExportCodingSessionHistoryButton } from './ExportCodingSessionHistoryButton';

const sessions: ICodingSession[] = [
  {
    id: 'session-one',
    problemIds: ['problem-one'],
    problemsAttempted: 1,
    problemsSolved: 1,
    status: 'completed',
    startedAt: '2026-11-01T10:00:00.000Z',
    completedAt: '2026-11-01T10:10:00.000Z',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ExportCodingSessionHistoryButton', () => {
  it('downloads only the provided coding history page as CSV', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((file: Blob | MediaSource) => {
      expect(file).toBeInstanceOf(Blob);
      return 'blob:coding-history';
    });
    const revokeObjectURL = vi.fn();
    let downloadedFilename: string | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadedFilename = this.download;
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    render(<ExportCodingSessionHistoryButton sessions={sessions} page={3} />);

    await user.click(screen.getByRole('button', { name: 'Export current page CSV' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const file = createObjectURL.mock.calls[0]?.[0];
    expect(file).toBeInstanceOf(Blob);
    if (!(file instanceof Blob)) throw new Error('Expected a CSV Blob to be downloaded.');
    expect(file.type).toBe('text/csv;charset=utf-8');
    await expect(file.text()).resolves.toContain('session-one');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:coding-history');
    expect(downloadedFilename).toBe('prepai-coding-session-history-page-3.csv');
  });
});
