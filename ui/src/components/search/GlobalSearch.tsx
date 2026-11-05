import { Dialog } from '@base-ui/react/dialog';
import { ArrowRight, BookOpen, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import type { IGlobalSearchResult } from '@/core';
import type { IGlobalSearchProps } from './GlobalSearch.types';

export const GlobalSearch = (props: IGlobalSearchProps) => {
  const {
    isOpen,
    query,
    results,
    isLoading,
    errorMessage,
    theme,
    onOpenChange,
    onQueryChange,
    onRetry,
    onSelect,
  } = props;
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchId = useId();
  const listboxId = `${searchId}-results`;
  const activeResultId =
    activeIndex >= 0 && results[activeIndex]
      ? `${searchId}-option-${results[activeIndex].type}-${results[activeIndex].id}`
      : undefined;
  const isLight = theme === 'light';

  useEffect(() => {
    const openFromKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', openFromKeyboard);
    return () => window.removeEventListener('keydown', openFromKeyboard);
  }, [onOpenChange]);

  useEffect(() => setActiveIndex(-1), [query, results]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onQueryChange('');
      setActiveIndex(-1);
    }
    onOpenChange(nextOpen);
  };

  const selectResult = (result: IGlobalSearchResult) => {
    onSelect(result);
    handleOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        type="button"
        aria-label="Search pages and topics"
        title="Search pages and topics (Ctrl+K)"
        className={`flex size-9 items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-amber-400 ${isLight ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'}`}
      >
        <Search aria-hidden="true" className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[open]:animate-in data-[open]:fade-in" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-3 pt-[12vh] sm:px-5 sm:pt-[16vh]">
          <Dialog.Popup
            className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-[0_24px_80px_rgba(0,0,0,0.4)] ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/[0.1] bg-[#18181b] text-zinc-100'}`}
          >
            <header className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5">
              <div>
                <Dialog.Title className="text-base font-semibold tracking-tight">
                  Search PrepAI
                </Dialog.Title>
                <Dialog.Description
                  className={`mt-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}
                >
                  Find a page or start practice for a topic.
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close search"
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-amber-400 ${isLight ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100'}`}
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </header>

            <div className="px-4 pb-4 sm:px-5">
              <div
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/10 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/[0.1] bg-[#111113]'}`}
              >
                <Search
                  aria-hidden="true"
                  className={`size-4 shrink-0 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}
                />
                <input
                  autoFocus
                  aria-activedescendant={activeResultId}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded={isOpen}
                  aria-label="Search pages and topics"
                  className={`min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500 ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}
                  onChange={(event) => onQueryChange(event.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search pages and practice topics…"
                  role="combobox"
                  type="search"
                  value={query}
                />
                <kbd
                  className={`hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline ${isLight ? 'border-zinc-200 text-zinc-500' : 'border-white/[0.1] text-zinc-500'}`}
                >
                  ESC
                </kbd>
              </div>

              <div
                id={listboxId}
                aria-label="Search results"
                className="mt-2 max-h-[min(52vh,24rem)] overflow-y-auto"
                role="listbox"
              >
                {results.map((result, index) => {
                  const optionId = `${searchId}-option-${result.type}-${result.id}`;
                  const isActive = activeIndex === index;
                  return (
                    <div
                      key={`${result.type}:${result.id}`}
                      id={optionId}
                      aria-label={`${result.label} ${result.category}`}
                      aria-selected={isActive}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none ${isActive ? 'bg-amber-400/15 text-amber-200' : isLight ? 'text-zinc-800 hover:bg-zinc-100' : 'text-zinc-200 hover:bg-white/[0.05]'}`}
                      onClick={() => selectResult(result)}
                      onMouseMove={() => setActiveIndex(index)}
                      role="option"
                    >
                      {result.type === 'topic' ? (
                        <BookOpen aria-hidden="true" className="size-4 shrink-0 text-amber-400" />
                      ) : (
                        <ArrowRight
                          aria-hidden="true"
                          className={`size-4 shrink-0 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{result.label}</span>
                      <span
                        className={`shrink-0 text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}
                      >
                        {result.category}
                      </span>
                    </div>
                  );
                })}
              </div>

              {isLoading && (
                <p
                  role="status"
                  className={`flex items-center gap-2 px-3 py-2 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}
                >
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  Loading practice topics
                </p>
              )}
              {errorMessage && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <p role="alert" className="text-xs text-rose-500">
                    {errorMessage}
                  </p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="min-h-8 rounded-md px-2 text-xs font-semibold text-amber-500 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    Retry topics
                  </button>
                </div>
              )}
              {query.trim() && !isLoading && !errorMessage && results.length === 0 && (
                <p
                  className={`px-3 py-5 text-center text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}
                >
                  No results for “{query.trim()}”
                </p>
              )}
              {!query.trim() && (
                <p className="px-3 py-3 text-xs text-zinc-500">
                  Type to search implemented pages and available practice topics.
                </p>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
