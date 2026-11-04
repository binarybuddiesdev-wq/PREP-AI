# Tech Expert Streaming Implementation Plan

> **For agentic workers:** execute task-by-task with TDD; keep each task small.

**Goal:** Add an incremental SSE endpoint for tech-expert answers.

**Architecture:** Keep the current JSON endpoint intact. Add an async stream
service path using the registered Mastra agent; handle fallback before the
first yielded chunk only, and use SSE events for deltas, completion, and
mid-stream errors.

**Tech Stack:** NestJS, Fastify, Mastra `Agent.stream()`, Vitest.

**Spec:** [Tech Expert Streaming Design](../specs/2026-11-04-tech-expert-streaming-design.md)

## Global Constraints

- Keep existing API contracts and layers intact.
- Preserve provider metric labels and make telemetry best-effort.
- Do not expose provider credentials or raw provider errors in SSE events.
- Do not add dependencies or persist one-shot conversations.

## Review Focus

- Provider fails before first chunk: try configured fallback provider.
- Provider fails after first chunk: send error and never splice a fallback.
- Client disconnects mid-stream: stop consuming upstream output.
- Telemetry callback fails: stream result remains unaffected.
- No LLM provider key configured: return a controlled error without leaking secrets.

### Task 1: Provider-aware stream helper

**Files:**

- Modify: `server/src/mastra/providers.ts`
- Test: `server/src/mastra/providers.spec.ts`

- [x] Test and implement `streamWithFailover` for pre-output retry only.
- [x] Verify the provider tests.

### Task 2: Tech-expert stream service and SSE route

**Files:**

- Modify: `server/src/modules/tech-expert/tech-expert.service.ts`
- Modify: `server/src/modules/tech-expert/tech-expert.controller.ts`
- Tests: corresponding service and controller specs.

- [x] Test text delta and terminal event ordering.
- [x] Test backpressure, mid-stream provider error, and disconnect cancellation.
- [x] Implement the service stream and `POST /tech-expert/stream` SSE route.
- [x] Verify focused tests and the full server gate.

### Task 3: Keep implementation status accurate

**Files:**

- Modify: `docs/backend-status.md`
- Modify: `docs/architecture/TODO.md`
- Modify: `docs/architecture/architecture.md`
- Modify: `docs/WORKLOG.md`

- [x] Update streaming status and correct stale observability, queue, and
      Mastra-capability statements surfaced during the implementation.
- [x] Run formatting and agent-doc checks.
- [x] Commit and push the verified change.
