# Tech Expert Streaming Design

## Goal

Let clients receive technology answers incrementally while preserving the
existing structured `POST /tech-expert` response contract.

## Decision

Add `POST /tech-expert/stream` as a Server-Sent Events endpoint. It uses the
existing Mastra tech-expert agent and provider selection. The stream emits
`delta` events containing plain-text chunks, then a `done` event. Errors before
the first chunk can use the existing NVIDIA-to-Groq fallback. If a provider
fails after output has begun, emit a generic `error` event and close the
stream; do not splice a second provider's answer into the first.

The existing endpoint remains unchanged. Streaming is one-shot and does not
persist conversation state. It does not add Mastra Memory, workflow
orchestration, or a new client dependency.

## Failure and lifecycle behavior

- Validate requests with the existing question schema.
- An unavailable or invalid provider configuration returns the normal HTTP
  error before the stream begins whenever possible.
- Once SSE headers are sent, encode provider failures as an `error` event.
- Stop consuming the model stream when the client disconnects.
- Respect response backpressure so a slow client does not cause unbounded buffering.
- Record provider attempt and failover metrics using the existing metric
  labels; ensure telemetry failures never replace model output or errors.

## Verification

Test pre-output provider fallback, post-output failure without fallback,
normal delta/done ordering, and cancellation on client disconnect. Run the
server full gate before committing.
