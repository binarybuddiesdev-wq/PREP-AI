# Theory Practice Theme Parity

**Goal:** Make the Practice setup, question, feedback, and completion views
readable in both themes, including retry and error states.

**Approach:** Keep the page composition, data readers, commands, and session
state transitions unchanged. Replace fixed dark styling in the practice route
and presentational components with shared theme and semantic tokens.

## Files

- `ui/src/pages/PracticePage.tsx` and its tests.
- `ui/src/components/practice/PracticeSetup.tsx`,
  `TheoryQuestionCard.tsx`, `TheoryFeedback.tsx`, and
  `TheorySessionComplete.tsx`, with colocated tests.
- A focused Playwright theme check, the project tracker, and work log.

## Tasks

1. [x] Add component and route assertions for theme-token surfaces and capture
       the expected failures.
2. [x] Tokenize practice setup, question, feedback, completion, and route error
       states without changing session behavior.
3. [x] Verify computed colors and mobile overflow in Playwright; run the UI
       gate and required review.
4. [x] Record verified evidence, commit, and push the completed slice.

## Review focus

- Topic, weak-area, and PDF mode selection and validation remain unchanged.
- Answer, skip, retry, evaluation, completion, and source citation actions keep
  their existing behavior.
- Server errors and quotas continue to show their real messages and recovery
  actions.
