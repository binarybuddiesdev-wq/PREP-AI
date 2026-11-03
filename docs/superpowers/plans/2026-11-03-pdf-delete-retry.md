# PDF deletion retry implementation plan

## Task 1 — RED/GREEN delete retry behavior

- [x] Add tests for retry after completed deletion and retry while deletion is pending.
- [x] Return the tombstone state for completed deletes and preserve deterministic redispatch while pending.

## Task 2 — docs, verification, review, and push

- [x] Document retry behavior in the PDF API contract and backend trackers.
- [x] Run focused PDF tests, the full server gate, architecture viewer, and diff checks.
- [x] Request one fresh code review; no Critical/Important findings.
- [ ] Commit and push `main`.

## Review note

- Minor deferred: the controller's envelope still says `PDF deletion queued` and uses 202 when the service replays an already completed deletion. The response data correctly reports `status: deleted`.

## Review focus

- The owner-scoped tombstone is checked before returning a result; missing/unowned sources remain 404.
- Repeated pending delete calls enqueue only the same deterministic delete job.
- Completed deletion retries do not re-enqueue worker cleanup.
