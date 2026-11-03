# Coding session idempotency implementation plan

## Task 1 — RED/GREEN replay contract

- [x] Add failing service tests for deterministic IDs, matching replay, changed-selection conflict, and simultaneous create collision.
- [x] Implement actor-scoped session identity, effective selection fingerprint, replay lookup, and unique conflict recovery.

## Task 2 — controller, docs, and verification

- [x] Require and document `Idempotency-Key` on coding session start; update shared policy and backend tracking docs.
- [x] Update direct service callers and controller tests.
- [x] Run focused tests, then `pnpm gate -- --stack server --level full`, architecture viewer check, and `git diff --check`.
- [x] Request one fresh code review; no Critical/Important findings.
- [ ] Commit and push `main`.

## Review note

- Minor deferred: if the duplicate-insert recovery lookup itself fails, that exception bypasses the usual database error mapping. No behavior change was made for this edge case.

## Interfaces

- `CodingController.startSession(dto, userId, idempotencyKey)` forwards the header.
- `CodingService.startSession(dto, userId, idempotencyKey)` owns deterministic IDs, replay, and race handling.
- Fingerprint: effective assigned `problemIds`, compared as an unordered set because PostgreSQL `findMany` does not promise caller ordering.

## Review focus

- Omitted problem IDs replay the original automatically selected assignment without selecting again.
- Explicit IDs that differ from the stored assignment return 409.
- Duplicate create losers do not create a second session and replay only a matching assignment.
- Tenant context and ownership remain enforced.
