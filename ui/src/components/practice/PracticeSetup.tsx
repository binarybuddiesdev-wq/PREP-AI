import { BarChart3, FileText, RotateCw, Zap } from 'lucide-react';

import type { TheoryDifficulty } from '@/core';
import { SelectField } from '@/components/form';
import type { IPracticeSetupProps, PracticeMode } from './PracticeSetup.types';

const MODES: Array<{
  value: PracticeMode | 'pdf';
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
  'inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-amber-400';

export const PracticeSetup = (props: IPracticeSetupProps) => {
  const {
    mode,
    topicId,
    difficulty,
    totalQuestions,
    isPremium,
    topics,
    weakAreas,
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

  const cannotStart =
    isStarting ||
    (mode === 'topic'
      ? isTopicsLoading || Boolean(topicsError) || topics.length === 0 || !topicId
      : isWeakAreasLoading || Boolean(weakAreasError) || weakAreas.length === 0);
  const selectedTopic = topics.find((topic) => topic.id === topicId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <header>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--text-h)]">Practice</h1>
        <p className="text-sm text-zinc-400">
          Choose a practice mode and set the focus for your next session.
        </p>
      </header>

      <section aria-label="Practice mode" className="grid gap-3 sm:grid-cols-3">
        {MODES.map(({ value, label, description, icon: Icon }) => {
          const isDisabled = value === 'pdf';
          const isSelected = value === mode;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isDisabled ? undefined : isSelected}
              aria-label={isDisabled ? `${label}, unavailable yet` : label}
              disabled={isDisabled}
              onClick={() => {
                if (value !== 'pdf') onModeChange(value);
              }}
              className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:p-5 ${
                isSelected
                  ? 'border-amber-400/60 bg-amber-400/[0.07]'
                  : 'border-white/[0.08] bg-[#18181b] hover:border-white/20 hover:bg-white/[0.04]'
              } ${isDisabled ? 'cursor-not-allowed opacity-55' : ''}`}
            >
              <span
                className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${
                  value === 'weak'
                    ? 'bg-sky-400/10 text-sky-300'
                    : value === 'pdf'
                      ? 'bg-rose-400/10 text-rose-300'
                      : 'bg-amber-400/10 text-amber-300'
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="block text-sm font-semibold text-zinc-100">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-400">{description}</span>
              {isDisabled ? (
                <span className="mt-2 inline-block text-[0.7rem] font-medium text-zinc-500">
                  Unavailable yet
                </span>
              ) : null}
            </button>
          );
        })}
      </section>

      <section className="app-shell-panel rounded-xl border border-white/[0.08] bg-[#18181b] p-4 sm:p-5">
        {mode === 'topic' ? (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h2 className="mb-1 text-sm font-semibold text-[var(--text-h)]">Choose a topic</h2>
              <p className="mb-3 text-xs leading-5 text-zinc-400">
                Your questions will focus on the topic you select.
              </p>
              {topicsError ? (
                <div role="alert" className="space-y-3">
                  <p className="text-sm text-rose-300">{topicsError}</p>
                  <button type="button" className={retryButtonClassName} onClick={onRetryTopics}>
                    <RotateCw aria-hidden="true" className="size-3.5" />
                    Retry topics
                  </button>
                </div>
              ) : topics.length === 0 && !isTopicsLoading ? (
                <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-zinc-400">
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
              <p className="mb-2 text-xs font-medium text-zinc-400">Difficulty</p>
              <div role="group" aria-label="Difficulty" className="flex gap-2">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      difficulty === option
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                        : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-100'
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
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-h)]">
                The server will use your practice history
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                These recent results provide context. The server selects the questions when your
                session starts.
              </p>
            </div>
            {isWeakAreasLoading ? (
              <p role="status" className="text-sm text-zinc-400">
                Loading weak areas…
              </p>
            ) : weakAreasError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-rose-300">{weakAreasError}</p>
                <button type="button" className={retryButtonClassName} onClick={onRetryWeakAreas}>
                  <RotateCw aria-hidden="true" className="size-3.5" />
                  Retry weak areas
                </button>
              </div>
            ) : weakAreas.length === 0 ? (
              <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-sm text-zinc-400">
                Complete a few practice sessions to see weak areas here.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {weakAreas.map((area) => (
                  <li
                    key={area.topicId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-sm text-zinc-200">{area.topicName}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                      {area.avgScore.toFixed(1)}/10
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">Difficulty</p>
              <div role="group" aria-label="Difficulty" className="flex gap-2">
                {DIFFICULTIES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={difficulty === option}
                    onClick={() => onDifficultyChange(option)}
                    className={`min-h-9 rounded-lg border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      difficulty === option
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                        : 'border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-100'
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

      <section className="flex flex-col gap-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">Ready to practice?</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            {mode === 'topic'
              ? selectedTopic
                ? `${selectedTopic.name} · ${difficulty} difficulty`
                : `Choose a topic · ${difficulty} difficulty`
              : `Weak areas · ${difficulty} difficulty`}
            {' · '}
            {totalQuestions} questions requested. Server limits apply.
          </p>
          {isPremium ? (
            <span className="mt-1 block text-[0.7rem] text-amber-200/80">Premium session size</span>
          ) : null}
          {startError ? (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {startError}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={cannotStart}
          onClick={onStart}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Zap aria-hidden="true" className="size-4" />
          {isStarting ? 'Starting…' : 'Start practice'}
        </button>
      </section>
    </main>
  );
};
