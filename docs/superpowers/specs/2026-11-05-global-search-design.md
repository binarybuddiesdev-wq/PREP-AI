# Global Route and Topic Search Design

## Intent

Add the authenticated app-shell search shown in `prepai-ui.html`. It should
help a signed-in user reach an implemented page or start practice for a real
topic returned by the existing API.

## Goals

- Search the implemented destinations and server-returned practice topics,
  with case-insensitive matching on names and route keywords.
- Open from the header and `Ctrl+K` / `Command+K`; support arrow navigation,
  Enter selection, Escape dismissal, focus management, and screen-reader
  combobox/listbox semantics.
- Load topics only while search is open, through the existing typed API,
  Clerk-aware client, user-scoped TanStack Query key, and logic reader.
- Navigate to a selected destination. Selecting a topic opens Practice with
  that real topic preselected.
- Keep matched routes usable if topic loading fails; show loading, retry, and
  no-results states for the topic source.

## Non-goals

- Search private session content, coding problem catalogs, PDFs, or user data.
- Add a backend route, search service, dependency, permanent indexing, or
  client-side copies of server state.
- Render fixed sample topics or allow query text to construct unsafe URLs.

## Approaches

1. **Accessible dialog palette with existing API data.** Local route metadata
   is filtered with real topic data loaded on demand. This adds a focused
   keyboard flow and preserves backend ownership of topics.
2. **Expandable inline header field.** This resembles the prototype more
   literally, but uses header space poorly on narrow viewports and needs its
   own popup focus/escape behavior.
3. **Static destinations and topic examples.** This avoids requests but would
   present unverified demo data as real search results.

Choose approach 1. The project already uses Base UI Dialog for accessible
modal focus management, and `GET /topics?category=practice` provides the real
topic catalog. Use existing layers and no new API contract.

## Constraints

- Keep `core` types/routes, `service/api` I/O, `logic` readers/search matching,
  `components` props/events, and `pages` composition within ADR-0009.
- Topic results use the API's `id` and `name`; navigation encodes the selected
  ID as the Practice page's `topicId` query parameter.
- TDD covers search matching, auth/open gating, keyboard selection, API failure,
  and topic preselection.
