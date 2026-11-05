# Theory Session Detail Theme Parity

**Goal:** Make the saved Theory Session Detail route readable in light and dark
themes, including its empty, missing-session, completion, and saved-answer
states.

**Approach:** Keep session readers, completion commands, and component behavior
unchanged. Replace fixed dark colors in the page and presentational component
with the shared surface, text, focus, and semantic status tokens.

## Files

- `ui/src/pages/TheorySessionDetailPage.tsx` and its route tests.
- `ui/src/components/history/TheorySessionDetail.tsx` and its component tests.
- A focused Playwright theme check, the project tracker, and work log.

## Tasks

1. [x] Add route/component assertions for shared theme tokens and capture the
       expected failures.
2. [x] Tokenize the route's missing/not-found cards and the detail summary,
       saved answer cards, actions, evaluation states, and feedback.
3. [x] Verify computed colors and mobile overflow in Playwright; run the UI
       gate and required review.
4. [ ] Record verified evidence, commit, and push the completed slice.

## Review focus

- Completion remains disabled only while the command is pending.
- Queued/running evaluations still block premature session completion.
- Back navigation, 404 behavior, retry states, and saved answers are unchanged.
