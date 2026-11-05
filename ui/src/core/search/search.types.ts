import { ROUTES, type AppShellRoute } from '../routes';

export type SearchDestinationRoute = AppShellRoute | typeof ROUTES.settingsDocuments;

export interface IPageSearchResult {
  type: 'page';
  id: string;
  label: string;
  category: 'Page';
  keywords: readonly string[];
  route: SearchDestinationRoute;
}

export interface ITopicSearchResult {
  type: 'topic';
  id: string;
  label: string;
  category: 'Practice topic';
  keywords: readonly string[];
  route: typeof ROUTES.practice;
  topicId: string;
}

export type IGlobalSearchResult = IPageSearchResult | ITopicSearchResult;
