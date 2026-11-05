# Coding AI Review UI Design

## Goal

Let users request and read the asynchronous AI review for a completed coding
submission from the coding workspace.

## Existing backend contract

- `POST /coding/session/:sessionId/executions/:executionId/review` accepts only
  completed Submit executions and returns answer ID, review status, structured
  review JSON, and a safe failure code.
- The execution status endpoint includes its answer's review fields. Review
  statuses are `not_requested`, `queued`, `running`, `completed`, and `failed`.
- A repeated request for a queued, running, or completed review returns its
  current status. A failed review may be requested again and consumes a new
  daily review quota slot.
- Completed review data contains summary, time complexity, space complexity,
  strengths, and improvements. The UI must render only returned content and
  show the server's safe failure message as-is.

## Behavior

- Show the review action only for a completed Submit execution.
- Place the AI Review action beside Run and Submit in the editor toolbar and
  show the review flow in a focused, dismissible dialog like the reference.
- Request Review starts a review job. While queued/running, disable another
  request and poll the existing execution reader until the review is terminal.
- Show queued, running, completed, and failed review states. A failed review
  offers Retry Review. Map the safe `review_unavailable` code to a plain
  temporary-unavailable message. Request errors, including quota limits,
  remain visible beside the review and can be retried.
- Render summary, time/space complexity, strengths, and improvements when the
  backend returns a completed structured review.
- Do not poll when both execution and review are terminal.

## Architecture

- `core/coding`: review status/result and response types.
- `service/api/coding.api`: review request endpoint only.
- `logic/coding`: authenticated review mutation and execution polling while a
  review is queued or running.
- `pages/CodingProblemPage`: invokes the command and translates mutation/read
  state into presentational props.
- `components/coding/CodingProblemWorkspace`: renders the review state and
  emits the review action; it owns no API behavior. A presentational dialog
  renders the review status and returned feedback.

## Out of scope

Review-quality feedback collection, quota display values, and changes to the
Mastra review agent or server lifecycle are out of scope.
