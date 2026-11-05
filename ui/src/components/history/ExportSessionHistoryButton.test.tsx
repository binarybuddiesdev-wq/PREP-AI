import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ITheorySession } from '@/core';
import { ExportSessionHistoryButton } from './ExportSessionHistoryButton';

const session: ITheorySession = {
  id: 'session-1',
  topicId: 'topic-react',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 8,
  avgScore: 7.25,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:20:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
};

describe('ExportSessionHistoryButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloads a CSV named for the current history page', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((file: Blob) => {
      expect(file.type).toBe('text/csv;charset=utf-8');
      return 'blob:session-history';
    });
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    render(
      <ExportSessionHistoryButton
        sessions={[session, { ...session, id: 'session-2', topicId: 'topic-typescript' }]}
        page={2}
      />
    );
    const createElement = vi.spyOn(document, 'createElement');

    const exportButton = screen.getByRole('button', { name: 'Export current page CSV' });
    expect(exportButton).toHaveClass('border-[var(--border2)]');
    await user.click(exportButton);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session-history');
    const anchor = createElement.mock.results.findLast(
      (result) => result.value instanceof HTMLAnchorElement
    )?.value as HTMLAnchorElement | undefined;
    expect(anchor?.download).toBe('prepai-session-history-page-2.csv');
    const csvFile = createObjectURL.mock.calls[0][0];
    const csvText = await csvFile.text();
    expect(csvText).toContain('session-1');
    expect(csvText).toContain('session-2');
    expect(csvText.split('\r\n')).toHaveLength(3);
  });

  it('does not show an export action when the current page is empty', () => {
    const { container } = render(<ExportSessionHistoryButton sessions={[]} page={1} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });
});
