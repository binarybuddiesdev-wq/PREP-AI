import { describe, expect, it } from 'vitest';

import type { IPracticeTopic } from '@/core';
import { findGlobalSearchResults } from './searchResults';

const topics: IPracticeTopic[] = [
  {
    id: 'topic-react',
    name: 'React Hooks',
    slug: 'react-hooks',
    category: 'practice',
    icon: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'topic-design',
    name: 'System Design',
    slug: 'system-design',
    category: 'practice',
    icon: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

describe('findGlobalSearchResults', () => {
  it('matches real destinations and API topics without case sensitivity', () => {
    expect(findGlobalSearchResults('SETTINGS', topics)).toEqual([
      expect.objectContaining({ type: 'page', label: 'Settings' }),
    ]);
    expect(findGlobalSearchResults('hooks', topics)).toEqual([
      expect.objectContaining({ type: 'topic', id: 'topic-react', label: 'React Hooks' }),
    ]);
  });

  it('matches destination keywords and orders pages before matching topics', () => {
    expect(findGlobalSearchResults('session', topics).map((result) => result.type)).toEqual([
      'page',
      'page',
    ]);
    expect(findGlobalSearchResults('system', topics)).toEqual([
      expect.objectContaining({ type: 'topic', id: 'topic-design', label: 'System Design' }),
    ]);
  });

  it('returns no fixed suggestions for an empty or unmatched query', () => {
    expect(findGlobalSearchResults('   ', topics)).toEqual([]);
    expect(findGlobalSearchResults('not a real result', topics)).toEqual([]);
  });
});
