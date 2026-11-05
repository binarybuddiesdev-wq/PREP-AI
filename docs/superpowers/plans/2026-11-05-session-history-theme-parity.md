# Session History Theme Parity

**Goal:** Make the Practice and Coding history tabs readable in both themes,
including rows, expanded details, loading/error/empty states, pagination, and CSV
actions.

**Approach:** Keep the current route, query readers, components, and interactions.
Replace fixed dark colors with the shared theme and semantic tokens in the
existing presentation components. This follows the same token-based pattern as
Dashboard, PDF Library, and Settings > Plan.

## Files

- `ui/src/pages/SessionHistoryPage.tsx`: page heading, tab states, and export
  action colors.
- `ui/src/components/history/SessionHistoryTable.tsx` and
  `CodingSessionHistoryTable.tsx`: loading, error, empty, table, and pagination
  colors.
- `ui/src/components/history/SessionHistoryRow.tsx`,
  `CodingSessionHistoryRow.tsx`, and `CodingSubmissionDetail.tsx`: row, expanded
  detail, verdict, and AI review colors.
- `ui/src/components/history/ExportSessionHistoryButton.tsx` and
  `ExportCodingSessionHistoryButton.tsx`: theme-aware export action.
- Existing colocated tests, one Playwright theme render check, the project
  tracker, and the work log.

## Tasks

1. [x] Add component assertions for light/dark token classes and run them red.
2. [x] Move History page/list/coding detail colors to shared theme tokens without
       changing queries, pagination, expansion, retry, or export behavior.
3. [x] Check computed colors and mobile overflow in both themes in Playwright; run
       the UI gate and relevant browser checks.
4. [x] Record verified results in the tracker and work log. Commit and push the
       completed slice after review.

## Review focus

- Practice and Coding tabs retain independent pagination and query gating.
- Export remains limited to the current API-returned page.
- Loading, retry, empty, row expansion, evaluation, verdict, and AI review
  states retain their existing behavior and semantics.
