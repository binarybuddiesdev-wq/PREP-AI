import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { IPdfSource, ISettingsFormValues } from '@/core';
import { SettingsAIAndSourcesPanel } from './SettingsAIAndSourcesPanel';

const values: ISettingsFormValues = {
  targetRole: 'Backend Engineer',
  experienceLevel: 'Senior',
  targetCompanies: '',
  preferredTopics: ['React'],
  defaultDifficulty: 'Mid',
  sessionLength: 10,
  timerPerQuestion: 5,
  showHintsOnSkip: true,
  autoAdvance: false,
  dailyReminder: false,
  dailyReminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  weeklyProgressReport: true,
  newQuestionsAlert: false,
  streakMilestoneAlerts: true,
  emailDigest: false,
};

const source = (id: string, status: IPdfSource['status']): IPdfSource => ({
  id,
  displayName: `${id}.pdf`,
  byteSize: 2_400_000,
  pageCount: 14,
  status,
  activeRevision: status === 'ready' ? 1 : 0,
  failureCode: null,
  createdAt: '2026-11-06T00:00:00.000Z',
  updatedAt: '2026-11-06T00:00:00.000Z',
});

describe('SettingsAIAndSourcesPanel', () => {
  it('shows server-managed model truth and changes only ready PDF sources', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SettingsAIAndSourcesPanel
        values={values}
        pdfSources={[source('react', 'ready'), source('draft', 'processing')]}
        isLoading={false}
        errorMessage={null}
        deletingPdfId={null}
        onChange={onChange}
        onRetry={vi.fn()}
        onDeletePdf={vi.fn()}
        onOpenDocuments={vi.fn()}
      />
    );

    expect(
      screen.getByText('AI provider and model are managed by your server configuration.')
    ).toBeVisible();
    expect(
      screen.getByRole('switch', { name: 'Include react.pdf as a question source' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('switch', { name: 'Include draft.pdf as a question source' })
    ).toBeDisabled();

    await user.click(
      screen.getByRole('switch', { name: 'Include react.pdf as a question source' })
    );
    expect(onChange).toHaveBeenCalledWith({ ...values, enabledPdfSourceIds: [] });
    expect(screen.getByRole('switch', { name: 'Web Search' })).toBeDisabled();
  });

  it('offers a route to document management when the user has no PDF sources', async () => {
    const user = userEvent.setup();
    const onOpenDocuments = vi.fn();
    render(
      <SettingsAIAndSourcesPanel
        values={values}
        pdfSources={[]}
        isLoading={false}
        errorMessage={null}
        deletingPdfId={null}
        onChange={vi.fn()}
        onRetry={vi.fn()}
        onDeletePdf={vi.fn()}
        onOpenDocuments={onOpenDocuments}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Manage documents' }));
    expect(onOpenDocuments).toHaveBeenCalledOnce();
  });
});
