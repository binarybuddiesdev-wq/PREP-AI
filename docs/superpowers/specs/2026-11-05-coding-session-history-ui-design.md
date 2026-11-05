# Coding Session History UI Design

## Intent

Show signed-in learners their real coding sessions and saved submissions in the existing History screen, following the Session History table in `prepai-ui.html`. This closes the coding-history portion of Phase 5 without inventing records or relying on browser storage.

## Goals

- Add a Coding view beside the existing Practice history view.
- Use the paginated `GET /coding/sessions` API and preserve its server totals and order.
- Expand a session to load its owner-scoped detail and show saved submissions, verdicts, test counts, and structured AI review when returned.
- Include loading, empty, error/retry, detail-loading, and pagination states.
- Export only the visible page's actual coding-session rows to CSV.
- Keep requests in service/API and TanStack Query logic; use user-scoped query keys and presentational components.

## Non-goals and constraints

- Do not add fictional scores, topics, or durations. The coding API does not provide scores or problem/topic names in its session summary; show fields the API actually returns and resolve problem names only from the real problem catalogue, with a safe fallback when unavailable.
- Do not show the prototype's daily solve/review quota or coding streak values. `/coding/stats` is explicitly deferred in the backend API spec, and the paginated history response does not contain sufficient data to reproduce all of those metrics safely. Track stats separately until the backend contract exists.
- Do not merge separately paginated Practice and Coding APIs into one client-side feed. Each feed keeps its own page state so the UI does not load every historical record just to sort and paginate it.
- Do not add a new route; the prototype places both types under Session History.

## Approaches

1. **Merge both feeds into one sorted table.** Closest to the static prototype, but independent paginated endpoints cannot provide a globally correct page without fetching all records or adding a backend aggregation endpoint. Rejected for the unnecessary history-wide load and duplicate contract.
2. **Add Practice and Coding tabs to the existing History page.** Keeps both kinds of history together, preserves each endpoint's pagination and query lifecycle, and requires no backend change. Selected.
3. **Add a separate Coding History route.** Simple data boundary, but separates a flow the prototype presents as one Session History feature and adds navigation without a clear need. Rejected.

## Behavior

- Practice remains the initially selected tab and retains its existing pagination, details, and CSV behavior.
- Coding tab loads page 1 of coding-session history, shows session date, attempted/solved counts, duration when both timestamps exist, and in-progress/completed status.
- Expanding one coding session fetches `/coding/session/:sessionId`; show saved answers in server order, mapped to problem titles from real catalogue data when available, code language, accepted/error verdict, test-case counts, and review data only when the API returns it.
- Coding CSV export includes the current page and API-provided fields only.
- Pagination state is independent per tab. Changing a tab does not discard the other tab's selected page; changing a page closes the expanded detail for that tab.
- Error states preserve the table context and offer retry. Empty coding history offers navigation to Coding practice.
- CSV columns are Session date, Session ID, Problems attempted, Problems solved, Status, and Duration; dates use ISO timestamps and standard CSV quoting/escaping. The export covers only the visible server page.
- Coding review detail uses the current structured fields (`summary`, complexity, strengths, improvements) and statuses. The older `quality`/`suggestions` example in the API spec is stale and will be corrected as part of this task.

## Architecture and verification

- Add/extend core contracts, service functions, user-scoped TanStack Query keys/readers, and presentational coding-history components; compose them in `SessionHistoryPage`.
- Add tests first for API paths, query keys/readers, page tab/pagination/detail behavior, row loading/error/results, and CSV contents.
- Run the full UI mechanical gate, browser checks where authentication permits, scoped formatting, and architecture review.
