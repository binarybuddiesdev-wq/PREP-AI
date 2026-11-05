import type { IGlobalSearchResult, IPracticeTopic, ITopicSearchResult } from '@/core';
import { SEARCH_DESTINATIONS } from '@/core';

const MAX_SEARCH_RESULTS = 8;

const normalizeSearchText = (value: string): string =>
  value.normalize('NFKD').toLocaleLowerCase().trim();

export const findGlobalSearchResults = (
  query: string,
  topics: readonly IPracticeTopic[]
): IGlobalSearchResult[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const pageResults = SEARCH_DESTINATIONS.filter((destination) =>
    normalizeSearchText([destination.label, ...destination.keywords].join(' ')).includes(
      normalizedQuery
    )
  );
  const topicResults: ITopicSearchResult[] = topics
    .filter((topic) => normalizeSearchText(topic.name).includes(normalizedQuery))
    .map((topic) => ({
      type: 'topic',
      id: topic.id,
      label: topic.name,
      category: 'Practice topic',
      keywords: [],
      route: '/practice',
      topicId: topic.id,
    }));

  return [...pageResults, ...topicResults].slice(0, MAX_SEARCH_RESULTS);
};
