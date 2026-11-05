# Coding Catalog Theme Parity

**Goal:** Make the Coding Questions route's statistics, filters, problem cards,
empty states, and retry states readable in both themes.

**Approach:** Keep query readers, problem filtering, navigation, and retry
behavior unchanged. Replace the fixed dark catalog styling with shared theme
and semantic tokens.

## Files

- `ui/src/pages/CodingPage.tsx` and page tests.
- `ui/src/components/coding/CodingProblemCatalog.tsx` and its tests.
- `ui/src/components/coding/CodingStatsBar.tsx` and its tests.
- A focused Playwright check, project tracker, and work log.

## Tasks

1. [x] Add component assertions for shared theme tokens and capture expected
       failures.
2. [x] Tokenize catalog, filter, metric, and error surfaces without changing
       list behavior.
3. [x] Verify computed colors and mobile overflow in Playwright; run the UI
       gate and required review.
4. [x] Record verified results, commit, and push the slice.

## Review focus

- Topic/difficulty filtering, solved state, problem selection, and stats retry
  continue to use the existing props and event handlers.
- Server-owned stats and quota values remain unchanged.
