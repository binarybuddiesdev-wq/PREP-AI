# Session completion retry implementation plan

## Task 1 — RED/GREEN service behavior

- [x] Add tests for already-completed theory/coding sessions and concurrent completion winners.
- [x] Return the persisted completed record on retry; preserve conflicts when completion did not occur.

## Task 2 — verification, docs, review, and push

- [x] Update API behavior notes, shared idempotency policy, backend tracker, and worklog.
- [x] Run focused specs and the full server gate; run architecture viewer and diff checks.
- [x] Request one fresh code review; no Critical/Important findings.
- [ ] Commit and push `main`.

## Review focus

- Repeat completion returns the existing persisted result without another update.
- Conditional update races replay only after a fresh owner-scoped read confirms `completed`.
- A session still in progress after a lost update retains the existing conflict behavior.
- Theory scoring and pending-answer guards are unchanged.
