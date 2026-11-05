import { ROUTES } from '../routes';
import type { IPageSearchResult } from './search.types';

export const SEARCH_DESTINATIONS: readonly IPageSearchResult[] = [
  {
    type: 'page',
    id: ROUTES.dashboard,
    label: 'Dashboard',
    category: 'Page',
    keywords: ['home', 'overview', 'progress'],
    route: ROUTES.dashboard,
  },
  {
    type: 'page',
    id: ROUTES.practice,
    label: 'Practice',
    category: 'Page',
    keywords: ['topic', 'topics', 'session', 'interview'],
    route: ROUTES.practice,
  },
  {
    type: 'page',
    id: ROUTES.coding,
    label: 'Coding',
    category: 'Page',
    keywords: ['problems', 'programming', 'dsa'],
    route: ROUTES.coding,
  },
  {
    type: 'page',
    id: ROUTES.history,
    label: 'History',
    category: 'Page',
    keywords: ['session', 'sessions', 'past', 'results', 'submissions'],
    route: ROUTES.history,
  },
  {
    type: 'page',
    id: ROUTES.settings,
    label: 'Settings',
    category: 'Page',
    keywords: ['account', 'preferences', 'plan', 'billing'],
    route: ROUTES.settings,
  },
  {
    type: 'page',
    id: ROUTES.settingsDocuments,
    label: 'Documents',
    category: 'Page',
    keywords: ['pdf', 'library', 'files'],
    route: ROUTES.settingsDocuments,
  },
  {
    type: 'page',
    id: ROUTES.library,
    label: 'Library',
    category: 'Page',
    keywords: ['pdf', 'documents', 'files'],
    route: ROUTES.library,
  },
];
