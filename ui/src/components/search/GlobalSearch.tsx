import { ArrowRight, BookOpen, LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const listboxId = `${searchId}-results`;
  const activeResultId =
    activeIndex >= 0 && results[activeIndex]
      ? `${searchId}-option-${results[activeIndex].type}-${results[activeIndex].id}`
      : undefined;
  const isLight = theme === 'light';

  useEffect(() => {
    const openFromKeyboard: (event: WindowEventMap['keydown']) => void = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', openFromKeyboard);
    return () => window.removeEventListener('keydown', openFromKeyboard);
  }, [onOpenChange]);

  useEffect(() => setActiveIndex(-1), [query, results]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) handleOpenChange(false);
    };
    window.addEventListener('pointerdown', closeFromOutside);
    return () => window.removeEventListener('pointerdown', closeFromOutside);
  }, [isOpen]);

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

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
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
    <div ref={rootRef} className="relative flex items-center">
      {isOpen ? (
        <div
          className={`flex h-8 w-[min(240px,calc(100vw-10rem))] items-center gap-2 rounded-lg border px-3 ${isLight ? 'border-zinc-200 bg-black/[0.03]' : 'border-white/[0.08] bg-white/[0.04]'}`}
        >
          <Search aria-hidden="true" className="size-4 shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            aria-activedescendant={activeResultId}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={Boolean(query.trim())}
            aria-label="Search pages and topics"
            className={`min-w-0 flex-1 bg-transparent text-[0.825rem] outline-none placeholder:text-zinc-500 ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                handleOpenChange(false);
              } else {
                handleKeyDown(event);
              }
            }}
            placeholder="Search…"
            role="combobox"
            type="search"
            value={query}
          />
          <button
            type="button"
            aria-label="Close search"
            onClick={() => handleOpenChange(false)}
            className="grid size-5 shrink-0 place-items-center text-zinc-500 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Search pages and topics"
          title="Search pages and topics (Ctrl+K)"
          onClick={() => onOpenChange(true)}
          className={`flex size-[34px] items-center justify-center rounded-lg border transition focus-visible:outline-2 focus-visible:outline-amber-400 ${isLight ? 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'}`}
        >
          <Search aria-hidden="true" className="size-4" />
        </button>
      )}
      {isOpen && query.trim() && (
        <div
          className={`fixed right-4 top-14 z-50 max-h-[300px] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-xl border p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] sm:right-8 ${isLight ? 'border-zinc-200 bg-white text-zinc-900 shadow-black/10' : 'border-white/[0.08] bg-[#18181b] text-zinc-100'}`}
        >
          <div id={listboxId} aria-label="Search results" role="listbox">
            {results.map((result, index) => {
              const optionId = `${searchId}-option-${result.type}-${result.id}`;
              const isActive = activeIndex === index;
              return (
                <div
                  key={`${result.type}:${result.id}`}
                  id={optionId}
                  aria-label={`${result.label} ${result.category}`}
                  aria-selected={isActive}
                  className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none ${isActive ? 'bg-amber-400/15 text-amber-200' : isLight ? 'text-zinc-800 hover:bg-zinc-100' : 'text-zinc-200 hover:bg-white/[0.05]'}`}
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
                  <span className="shrink-0 text-[11px] text-zinc-500">{result.category}</span>
                </div>
              );
            })}
          </div>
          {isLoading && (
            <p role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500">
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
          {!isLoading && !errorMessage && results.length === 0 && (
            <p className="px-3 py-5 text-center text-sm text-zinc-500">
              No results for “{query.trim()}”
            </p>
          )}
        </div>
      )}
    </div>
  );
};
