import { useState, type ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IGlobalSearchResult } from '@/core';
import { GlobalSearch } from './GlobalSearch';

const results: IGlobalSearchResult[] = [
  {
    type: 'page',
    id: '/practice',
    label: 'Practice',
    category: 'Page',
    keywords: [],
    route: '/practice',
  },
  {
    type: 'topic',
    id: 'topic-react',
    label: 'React Hooks',
    category: 'Practice topic',
    keywords: [],
    route: '/practice',
    topicId: 'topic-react',
  },
];

const renderSearch = (overrides: Partial<ComponentProps<typeof GlobalSearch>> = {}) => {
  const props = {
    isOpen: false,
    query: '',
    results: [],
    isLoading: false,
    errorMessage: null,
    theme: 'dark' as const,
    onOpenChange: vi.fn(),
    onQueryChange: vi.fn(),
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  const SearchHarness = () => {
    const [isOpen, setIsOpen] = useState(props.isOpen);
    const [query, setQuery] = useState(props.query);
    return (
      <GlobalSearch
        {...props}
        isOpen={isOpen}
        query={query}
        onOpenChange={(nextOpen) => {
          props.onOpenChange(nextOpen);
          setIsOpen(nextOpen);
        }}
        onQueryChange={(nextQuery) => {
          props.onQueryChange(nextQuery);
          setQuery(nextQuery);
        }}
      />
    );
  };
  render(<SearchHarness />);
  return props;
};

describe('GlobalSearch', () => {
  it('opens from the header and selects a topic with arrow keys and Enter', async () => {
    const user = userEvent.setup();
    const props = renderSearch({ isOpen: false, query: 'react', results });
    await user.click(screen.getByRole('button', { name: 'Search pages and topics' }));
    const searchInput = screen.getByRole('combobox', { name: 'Search pages and topics' });
    const listbox = screen.getByRole('listbox', { name: 'Search results' });

    expect(searchInput).toHaveFocus();
    expect(within(listbox).getByRole('option', { name: 'Practice Page' })).toBeVisible();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(props.onSelect).toHaveBeenCalledWith(results[1]);
  });

  it('shows a retry action when topic loading fails while keeping page results available', async () => {
    const user = userEvent.setup();
    const props = renderSearch({
      isOpen: true,
      query: 'coding',
      results: [results[0]],
      errorMessage: 'Practice topics could not be loaded.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Practice topics could not be loaded.');
    expect(screen.getByRole('option', { name: 'Practice Page' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry topics' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('shows loading and empty states and closes when Escape is pressed', async () => {
    const user = userEvent.setup();
    const props = renderSearch({ isOpen: true, query: 'missing', isLoading: true });

    expect(screen.getByRole('status')).toHaveTextContent('Loading practice topics');
    expect(screen.queryByText(/no results/i)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('opens from the keyboard shortcut and labels a no-results response', async () => {
    const user = userEvent.setup();
    const props = renderSearch({ isOpen: true, query: 'missing' });

    expect(screen.getByText(/No results for.*missing/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close search' }));
    await user.keyboard('{Control>}k{/Control}');

    expect(props.onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
