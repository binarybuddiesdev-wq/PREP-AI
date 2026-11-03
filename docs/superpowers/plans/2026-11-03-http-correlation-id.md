# HTTP Correlation ID Implementation Plan

1. Add failing tests for UUID validation/generation and response header echo.
2. Configure Fastify `genReqId` to use the validated `X-Request-Id` or a new
   UUID; register the response echo hook during app configuration.
3. Expose `X-Request-Id` through CORS and document the header contract.
4. Run focused tests, the full server gate, database isolation, architecture
   viewer check, and `git diff --check`; request a read-only review.
5. Commit and push to `main`, then continue with the next backend item.

Design: `docs/superpowers/specs/2026-11-03-http-correlation-id-design.md`.
