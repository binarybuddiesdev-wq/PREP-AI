import { ArrowRight, BarChart3, FileText, RotateCw, Zap } from 'lucide-react';

import type { TheoryDifficulty } from '@/core';
import { PracticeQuotaBanner } from './PracticeQuotaBanner';
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
    description: 'Pick topics you want to focus on and start practicing.',
    icon: Zap,
  },
  {
    value: 'weak',
    label: 'Weak Areas',
    description: 'AI picks topics where you scored lowest and helps you improve.',
    icon: BarChart3,
  },
  {
    value: 'pdf',
    label: 'PDF Study',
    description: 'Get quizzed on content from your uploaded PDF documents.',
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
    dailySessions,
    isDailySessionsLoading,
    isDailySessionsFetching,
    dailySessionsError,
    onRetryDailySessions,
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
  const isDailyQuotaReached = dailySessions !== null && dailySessions.used >= dailySessions.limit;
  const cannotStart =
    isStarting ||
    isDailyQuotaReached ||
    (mode === 'topic'
      ? isTopicsLoading || Boolean(topicsError) || topics.length === 0 || !topicId
      : mode === 'weak'
        ? isWeakAreasLoading || Boolean(weakAreasError) || weakAreas.length === 0
        : isPdfSourcesLoading || Boolean(pdfSourcesError) || !hasValidPdfSelection);
  const selectedTopic = topics.find((topic) => topic.id === topicId);

  return (
    <main className="mx-auto w-full space-y-5 pt-1 sm:space-y-6">
      <header>
        <h1 className="m-0 mb-[0.2rem] text-[1.35rem] font-bold text-[var(--text-h)]">
          Practice Session
        </h1>
        <p className="text-[0.9rem] text-[var(--dim)]">
          Choose how you want to practice, then configure your session.
        </p>
      </header>

      <PracticeQuotaBanner
        dailySessions={dailySessions}
        isLoading={isDailySessionsLoading}
        isRetrying={isDailySessionsFetching}
        errorMessage={dailySessionsError}
        onRetry={onRetryDailySessions}
      />

      <section
        aria-label="Practice mode"
        className="grid grid-cols-1 gap-4 min-[1025px]:grid-cols-3"
      >
        {MODES.map(({ value, label, description, icon: Icon }) => {
          const isSelected = value === mode;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => onModeChange(value)}
              className={`rounded-[14px] border p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isSelected
                  ? 'border-[var(--accent)] bg-[rgba(245,158,11,0.04)] shadow-[0_0_0_1px_var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border2)]'
              }`}
            >
              <span
                className={`mx-auto mb-3 flex size-12 items-center justify-center rounded-xl text-[1.3rem] ${
                  value === 'weak'
                    ? 'bg-[var(--blue-bg)] text-[var(--info-strong)]'
                    : value === 'pdf'
                      ? 'bg-[var(--red-bg)] text-[var(--danger-strong)]'
                      : 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="mb-[0.35rem] block text-[0.95rem] font-semibold text-[var(--text-h)]">
                {label}
              </span>
              <span className="block text-[0.8rem] leading-[1.5] text-[var(--dim)]">
                {description}
              </span>
            </button>
          );
        })}
      </section>

      <section className="app-shell-panel rounded-[14px] border border-[var(--border)] bg-[var(--card)] p-6">
        {mode === 'topic' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <span className="mr-0.5 text-[0.78rem] font-medium text-[var(--faint)]">Topics</span>
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
                <>
                  <div role="group" aria-label="Topics" className="flex flex-wrap gap-1">
                    {topics.map((topic) => {
                      const isSelected = topic.id === topicId;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          aria-pressed={isSelected}
                          disabled={isTopicsLoading}
                          onClick={() => onTopicChange(topic.id)}
                          className={`min-h-9 rounded-full border px-[0.9rem] text-[0.78rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60 ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)] text-zinc-950' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border2)] hover:text-[var(--text)]'}`}
                        >
                          {topic.name}
                        </button>
                      );
                    })}
                  </div>
                  {isTopicsLoading ? (
                    <p role="status" className="mt-2 text-xs text-[var(--dim)]">
                      Loading topics…
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <span className="mr-0.5 text-[0.78rem] font-medium text-[var(--faint)]">
                Difficulty
              </span>
              <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-1">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-full border px-[0.9rem] text-[0.78rem] font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      difficulty === option
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-zinc-950'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border2)] hover:text-[var(--text)]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : mode === 'weak' ? (
          <div className="space-y-5">
            <div className="mb-5 flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--blue-bg)] text-[var(--info-strong)]">
                <BarChart3 aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-[0.95rem] font-semibold text-[var(--text-h)]">
                  AI will pick your weak topics
                </h2>
                <p className="mt-1 text-[0.85rem] leading-6 text-[var(--dim)]">
                  Based on your session history, we&apos;ll focus on areas where you need the most
                  improvement.
                </p>
              </div>
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
              <ul className="flex flex-col gap-[0.65rem]">
                {weakAreas.map((area) => (
                  <li key={area.topicId} className="flex items-center gap-3">
                    <span className="min-w-[110px] truncate text-[0.825rem] font-medium text-[var(--text)]">
                      {area.topicName}
                    </span>
                    <span
                      role="progressbar"
                      aria-label={`${area.topicName} average score`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(area.avgScore * 10)}
                      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface2)]"
                    >
                      <span
                        className={`block h-full rounded-full ${area.avgScore < 5 ? 'bg-[var(--red)]' : area.avgScore < 6.5 ? 'bg-[var(--accent)]' : 'bg-[var(--blue)]'}`}
                        style={{ width: `${Math.max(0, Math.min(100, area.avgScore * 10))}%` }}
                      />
                    </span>
                    <span
                      className={`min-w-10 text-right text-[0.78rem] font-semibold tabular-nums ${area.avgScore < 5 ? 'text-[var(--red)]' : area.avgScore < 6.5 ? 'text-[var(--accent)]' : 'text-[var(--info-strong)]'}`}
                    >
                      {Math.round(area.avgScore * 10)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[0.8rem] text-[var(--faint)]">
              Topics below 70% score will be included in this session.
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              <span className="mr-0.5 text-[0.78rem] font-medium text-[var(--faint)]">
                Difficulty
              </span>
              <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-1">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-full border px-[0.9rem] text-[0.78rem] font-medium transition focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                      difficulty === option
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-zinc-950'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)] hover:border-[var(--border2)] hover:text-[var(--text)]'
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

      <section className="mx-auto mt-8 w-full max-w-[480px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-center">
        <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <Zap aria-hidden="true" className="size-8" />
        </span>
        <h2 className="mb-2 text-[1.3rem] font-bold text-[var(--text-h)]">Ready to Practice?</h2>
        <p className="mb-6 text-[0.9rem] leading-[1.6] text-[var(--dim)]">
          You&apos;ve selected{' '}
          <strong className="font-semibold text-[var(--text)]">
            {mode === 'topic'
              ? (selectedTopic?.name ?? 'a topic')
              : mode === 'weak'
                ? 'your weak areas'
                : `${selectedPdfIds.length} PDF${selectedPdfIds.length === 1 ? '' : 's'}`}
          </strong>{' '}
          at <strong className="font-semibold text-[var(--text)]">{difficulty}</strong> level. This
          session includes{' '}
          <strong className="font-semibold text-[var(--text)]">{totalQuestions} questions</strong>.
        </p>
        <div className="mb-8 flex justify-center gap-6">
          <div className="text-center">
            <strong className="block text-lg font-bold text-[var(--text)]">
              {MODES.find((item) => item.value === mode)?.label}
            </strong>
            <span className="text-xs text-[var(--faint)]">Mode</span>
          </div>
          <div className="text-center">
            <strong className="block text-lg font-bold text-[var(--text)]">{difficulty}</strong>
            <span className="text-xs text-[var(--faint)]">Difficulty</span>
          </div>
          <div className="text-center">
            <strong className="block text-lg font-bold text-[var(--text)]">{totalQuestions}</strong>
            <span className="text-xs text-[var(--faint)]">Questions</span>
          </div>
        </div>
        {isPremium ? (
          <p className="mb-4 text-xs text-[var(--accent-strong)]">Premium session size</p>
        ) : null}
        {startError ? (
          <p role="alert" className="mb-4 text-sm text-[var(--danger-strong)]">
            {startError}
          </p>
        ) : null}
        <button
          type="button"
          aria-label="Start practice"
          disabled={cannotStart}
          onClick={onStart}
          className="mx-auto inline-flex min-h-12 min-w-[200px] items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-7 text-sm font-bold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStarting ? 'Starting…' : 'Start Session'}
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </section>
    </main>
  );
};
