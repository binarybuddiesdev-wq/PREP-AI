import { useEffect } from 'react';
import { ArrowLeft, ChevronDown, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

import type { CodingLanguage } from '@/core';
import { CodingProblemContent } from './CodingProblemContent';
import { CodingEditor } from './CodingEditor';
import type { ICodingProblemWorkspaceProps } from './CodingProblemWorkspace.types';

const LANGUAGES: readonly { value: CodingLanguage; label: string; extension: string }[] = [
  { value: 'javascript', label: 'JavaScript', extension: 'js' },
  { value: 'typescript', label: 'TypeScript', extension: 'ts' },
  { value: 'python', label: 'Python', extension: 'py' },
];

export const CodingProblemWorkspace = (props: ICodingProblemWorkspaceProps) => {
  const {
    problem,
    language,
    code,
    outputTab,
    isProblemCollapsed,
    isFullscreen,
    onBack,
    onLanguageChange,
    onCodeChange,
    onResetCode,
    onOutputTabChange,
    onToggleProblem,
    onToggleFullscreen,
  } = props;
  const selectedLanguage = LANGUAGES.find((item) => item.value === language) ?? LANGUAGES[0];
  const fileBaseName = problem.title
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
    )
    .join('');
  const filename = `${fileBaseName}.${selectedLanguage.extension}`;

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggleFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, onToggleFullscreen]);

  const workspace = (
    <section
      aria-label="Coding workspace"
      className="coding-workspace flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#141416]"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] px-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to problems
        </button>
        {isProblemCollapsed ? (
          <button
            type="button"
            onClick={onToggleProblem}
            aria-label="Show problem description"
            className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            Show problem
          </button>
        ) : null}
      </div>

      <div
        className={`coding-workspace-grid grid min-h-0 flex-1 gap-3 p-3 ${isProblemCollapsed ? 'grid-cols-1' : 'grid-cols-1 grid-rows-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.18fr)] lg:grid-rows-1'}`}
      >
        {!isProblemCollapsed ? (
          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#18181b]">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.07] px-3">
              <h2 className="text-xs font-semibold text-zinc-200">Problem</h2>
              <button
                type="button"
                onClick={onToggleProblem}
                aria-label="Hide problem description"
                title="Hide problem description"
                className="rounded-md px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                Hide
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <CodingProblemContent problem={problem} />
            </div>
          </section>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#18181b]">
            <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-2.5 py-1.5 sm:flex-nowrap">
              <span className="flex min-w-0 flex-1 items-center gap-2 px-1 font-mono text-[11px] text-zinc-400">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-400" />
                <span className="truncate">{filename}</span>
              </span>
              <label className="relative inline-flex shrink-0 items-center">
                <span className="sr-only">Programming language</span>
                <select
                  aria-label="Programming language"
                  value={language}
                  onChange={(event) =>
                    onLanguageChange(event.currentTarget.value as CodingLanguage)
                  }
                  style={{ colorScheme: 'dark' }}
                  className="coding-language-select h-8 min-w-[132px] appearance-none rounded-md border border-white/[0.11] bg-[#111113] py-1 pl-2.5 pr-8 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04] focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/25"
                >
                  {LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 size-3.5 text-zinc-500"
                />
              </label>
              <button
                type="button"
                onClick={onResetCode}
                aria-label="Reset code"
                title="Reset code"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.09] text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen editor' : 'Enter fullscreen editor'}
                title={isFullscreen ? 'Exit fullscreen editor' : 'Enter fullscreen editor'}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.09] text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                {isFullscreen ? (
                  <Minimize2 aria-hidden="true" className="size-3.5" />
                ) : (
                  <Maximize2 aria-hidden="true" className="size-3.5" />
                )}
              </button>
            </header>
            <div className="min-h-0 flex-1">
              <CodingEditor language={language} value={code} onChange={onCodeChange} />
            </div>
          </section>

          {!isFullscreen ? (
            <section
              className="flex h-[142px] shrink-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#18181b]"
              aria-label="Run results"
            >
              <div
                role="tablist"
                aria-label="Run result views"
                className="flex h-9 shrink-0 items-center gap-1 border-b border-white/[0.07] px-2"
              >
                {(['output', 'testcases'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={outputTab === tab}
                    onClick={() => onOutputTabChange(tab)}
                    className={`relative h-full px-2 text-xs transition ${outputTab === tab ? 'text-amber-300 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber-400' : 'text-zinc-500 hover:text-zinc-200'}`}
                  >
                    {tab === 'output' ? 'Output' : 'Test cases'}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-zinc-500"
              >
                {outputTab === 'output'
                  ? 'Run your code to see output.'
                  : 'Run your code to inspect each test case.'}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );

  if (!isFullscreen) return workspace;

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] p-2 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Fullscreen coding editor" className="h-full">
        {workspace}
      </div>
    </div>
  );
};
