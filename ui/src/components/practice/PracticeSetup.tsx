import { BarChart3, FileText, RotateCw, Zap } from 'lucide-react';

import type { TheoryDifficulty } from '@/core';
import { SelectField } from '@/components/form';
import type { IPracticeSetupProps, PracticeMode } from './PracticeSetup.types';

const MODES: Array<{
  value: PracticeMode;
  label: string;
  description: string;
  icon: typeof Zap;
}> = [
  {
    value: 'topic',
    label: 'Topic Practice',
    description: 'Choose a subject and focus your next session.',
    icon: Zap,
  },
  {
    value: 'weak',
    label: 'Weak Areas',
    description: 'Practice topics drawn from your recent results.',
    icon: BarChart3,
  },
  {
    value: 'pdf',
    label: 'PDF Study',
    description: 'Practice from your study documents.',
    icon: FileText,
  },
];

const DIFFICULTIES: TheoryDifficulty[] = ['Junior', 'Mid', 'Senior'];

const retryButtonClassName =
  'inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

export const PracticeSetup = (props: IPracticeSetupProps) => {
  const {
    mode,
    topicId,
    difficulty,
    totalQuestions,
    isPremium,
    topics,
    weakAreas,
    pdfSources,
    selectedPdfIds,
    isPdfSourcesLoading,
    pdfSourcesError,
    onRetryPdfSources,
    onPdfSelectionChange,
    onManageDocuments,
    isTopicsLoading,
    topicsError,
    onRetryTopics,
    isWeakAreasLoading,
    weakAreasError,
    onRetryWeakAreas,
    isStarting,
    startError,
    onModeChange,
    onTopicChange,
    onDifficultyChange,
    onStart,
  } = props;

  const readyPdfSources = pdfSources.filter((source) => source.status === 'ready');
  const validPdfIds = new Set(readyPdfSources.map((source) => source.id));
  const hasValidPdfSelection =
    selectedPdfIds.length >= 1 &&
    selectedPdfIds.length <= 5 &&
    selectedPdfIds.every((id) => validPdfIds.has(id));
  const cannotStart =
    isStarting ||
    (mode === 'topic'
      ? isTopicsLoading || Boolean(topicsError) || topics.length === 0 || !topicId
      : mode === 'weak'
        ? isWeakAreasLoading || Boolean(weakAreasError) || weakAreas.length === 0
        : isPdfSourcesLoading || Boolean(pdfSourcesError) || !hasValidPdfSelection);
  const selectedTopic = topics.find((topic) => topic.id === topicId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <header>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--text-h)]">Practice</h1>
        <p className="text-sm text-[var(--dim)]">
          Choose a practice mode and set the focus for your next session.
        </p>
      </header>

      <section aria-label="Practice mode" className="grid gap-3 sm:grid-cols-3">
        {MODES.map(({ value, label, description, icon: Icon }) => {
          const isSelected = value === mode;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => onModeChange(value)}
              className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:p-5 ${
                isSelected
                  ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border2)] hover:bg-[var(--surface)]'
              }`}
            >
              <span
                className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${
                  value === 'weak'
                    ? 'bg-[var(--blue-bg)] text-[var(--info-strong)]'
                    : value === 'pdf'
                      ? 'bg-[var(--red-bg)] text-[var(--danger-strong)]'
                      : 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="block text-sm font-semibold text-[var(--text-h)]">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--dim)]">{description}</span>
            </button>
          );
        })}
      </section>

      <section className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
        {mode === 'topic' ? (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h2 className="mb-1 text-sm font-semibold text-[var(--text-h)]">Choose a topic</h2>
              <p className="mb-3 text-xs leading-5 text-[var(--dim)]">
                Your questions will focus on the topic you select.
              </p>
              {topicsError ? (
                <div role="alert" className="space-y-3">
                  <p className="text-sm text-[var(--danger-strong)]">{topicsError}</p>
                  <button type="button" className={retryButtonClassName} onClick={onRetryTopics}>
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    Retry topics
                  </button>
                </div>
              ) : topics.length === 0 && !isTopicsLoading ? (
                <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--dim)]">
                  No practice topics are available yet.
                </p>
              ) : (
                <SelectField
                  id="practice-topic"
                  label="Practice topic"
                  placeholder={isTopicsLoading ? 'Loading topics…' : 'Select a topic'}
                  options={topics.map((topic) => ({ value: topic.id, label: topic.name }))}
                  value={topicId}
                  disabled={isTopicsLoading || topics.length === 0}
                  onChange={onTopicChange}
                />
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--dim)]">Difficulty</p>
              <div role="group" aria-label="Difficulty" className="flex gap-2">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      difficulty === option
                        ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                        : 'border-[var(--border2)] bg-[var(--surface)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : mode === 'weak' ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-h)]">
                The server will use your practice history
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
                These recent results provide context. The server selects the questions when your
                session starts.
              </p>
            </div>
            {isWeakAreasLoading ? (
              <p role="status" className="text-sm text-[var(--dim)]">
                Loading weak areas…
              </p>
            ) : weakAreasError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-[var(--danger-strong)]">{weakAreasError}</p>
                <button type="button" className={retryButtonClassName} onClick={onRetryWeakAreas}>
                  <RotateCw aria-hidden="true" className="size-3.5" />
                  Retry weak areas
                </button>
              </div>
            ) : weakAreas.length === 0 ? (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--dim)]">
                Complete a few practice sessions to see weak areas here.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {weakAreas.map((area) => (
                  <li
                    key={area.topicId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--text)]">
                      {area.topicName}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--dim)]">
                      {area.avgScore.toFixed(1)}/10
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--dim)]">Difficulty</p>
              <div role="group" aria-label="Difficulty" className="flex gap-2">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      difficulty === option
                        ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                        : 'border-[var(--border2)] bg-[var(--surface)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-h)]">Choose study sources</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
                  Choose 1–5 ready PDFs to focus this session.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--border2)] bg-[var(--surface)] px-2.5 py-1 text-xs tabular-nums text-[var(--text)]">
                {selectedPdfIds.length} of 5 selected
              </span>
            </div>
            {isPdfSourcesLoading ? (
              <p role="status" className="text-sm text-[var(--dim)]">
                Loading your PDFs…
              </p>
            ) : pdfSourcesError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-[var(--danger-strong)]">{pdfSourcesError}</p>
                <button type="button" className={retryButtonClassName} onClick={onRetryPdfSources}>
                  <RotateCw aria-hidden="true" className="size-3.5" />
                  Retry documents
                </button>
              </div>
            ) : readyPdfSources.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border2)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text)]">No ready PDFs yet</p>
                <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
                  Upload a document and wait for it to finish processing before starting PDF study.
                </p>
                <button
                  type="button"
                  onClick={onManageDocuments}
                  className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-[var(--border2)] px-3 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  Manage documents
                </button>
              </div>
            ) : (
              <ul aria-label="Ready study PDFs" className="flex flex-col gap-2">
                {readyPdfSources.map((source) => {
                  const checked = selectedPdfIds.includes(source.id);
                  const atLimit = selectedPdfIds.length >= 5 && !checked;
                  return (
                    <li key={source.id}>
                      <label
                        className={`flex min-h-[52px] items-center gap-3 rounded-[10px] border px-3 py-2.5 transition ${checked ? 'border-[var(--accent-border)] bg-[var(--accent-bg)]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border2)]'} ${atLimit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={atLimit}
                          onChange={() =>
                            onPdfSelectionChange(
                              checked
                                ? selectedPdfIds.filter((id) => id !== source.id)
                                : [...selectedPdfIds, source.id]
                            )
                          }
                          className="size-4 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        />
                        <span
                          aria-hidden="true"
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--red-bg)] text-[0.65rem] font-bold text-[var(--danger-strong)]"
                        >
                          PDF
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium text-[var(--text)]">
                            {source.displayName}
                          </span>
                          <span className="text-[0.7rem] text-[var(--dim)]">
                            {source.pageCount === null
                              ? 'Page count unavailable'
                              : `${source.pageCount} ${source.pageCount === 1 ? 'page' : 'pages'}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div>
              <p className="mb-2 text-xs font-medium text-[var(--dim)]">Difficulty</p>
              <div role="group" aria-label="Difficulty" className="flex gap-2">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      difficulty === option
                        ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                        : 'border-[var(--border2)] bg-[var(--surface)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-h)]">Ready to practice?</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--dim)]">
            {mode === 'topic'
              ? selectedTopic
                ? `${selectedTopic.name} · ${difficulty} difficulty`
                : `Choose a topic · ${difficulty} difficulty`
              : mode === 'weak'
                ? `Weak areas · ${difficulty} difficulty`
                : `${selectedPdfIds.length} PDF${selectedPdfIds.length === 1 ? '' : 's'} · ${difficulty} difficulty`}
            {' · '}
            {totalQuestions} questions requested. Server limits apply.
          </p>
          {isPremium ? (
            <span className="mt-1 block text-[0.7rem] text-[var(--accent-strong)]">
              Premium session size
            </span>
          ) : null}
          {startError ? (
            <p role="alert" className="mt-2 text-sm text-[var(--danger-strong)]">
              {startError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={cannotStart}
          onClick={onStart}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Zap aria-hidden="true" className="size-4" />
          {isStarting ? 'Starting…' : 'Start practice'}
        </button>
      </section>
    </main>
  );
};
