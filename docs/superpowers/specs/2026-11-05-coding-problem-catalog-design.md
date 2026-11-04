# Coding Problem Catalog Design

## Intent

Build the first real Coding Challenges screen from `prepai-ui.html`. A signed-in
learner can browse problems, narrow them by topic or difficulty, see which ones
they have solved, open a problem, and read its description, examples, and
constraints. The screen uses the authenticated coding APIs; it does not show
prototype sample records as user data.

## Goals and non-goals

- Provide a searchable-by-filter problem list and a shareable problem detail
  route.
- Use the backend's accepted submissions as the source of solved state.
- Show loading, empty, retryable error, and ready states for list and detail.
- Keep API calls in `service/api`, query state in `logic`, presentational
  components in `components`, and routing/state mapping in `pages`.
- Defer the code editor, execution, submission, AI review, stats, and history to
  the next Coding Challenges slices.

## Approaches

1. Fetch the unfiltered catalogue once and filter it locally. This keeps topic
   choices complete and makes filter changes immediate; the API list is a
   finite catalogue rather than user-generated data. **Chosen.**
2. Send each filter to the server. This reduces payloads, but the current API has
   no endpoint for the full topic set, so the UI would need extra requests or
   topic choices would disappear as filters change.
3. Put list and detail in one route with local selection. This is simpler, but
   cannot be deep-linked or refreshed on a selected problem. Detail uses a
   parameterized route instead.

## Data and interaction

- `GET /api/v1/coding/problems` returns problem summaries plus user-specific
  `isSolved`, derived only from accepted coding answers.
- `GET /api/v1/coding/problems/:problemId` returns the problem's description,
  examples, constraints, and language starter code.
- Topic and difficulty filters can be combined and reset independently to
  `All`. The list communicates the active result count and has an empty result
  message with a clear reset action.
- Selecting a problem navigates to `/coding/:problemId`. Back returns to the
  catalogue; direct URLs load the problem by id or slug.
- Unavailable catalogue/detail requests show the shared retryable error
  treatment.

## Constraints

- Keep the current React, TypeScript, React Router, TanStack Query, and Ky stack.
- Use the current layer rules and existing API client/session gate.
- Never use the HTML prototype's `codeProblems` array or local storage solved
  state.
- Preserve the reference's dark surface, amber accents, problem list, topic and
  difficulty filters, solved indicator, and detail content hierarchy.
