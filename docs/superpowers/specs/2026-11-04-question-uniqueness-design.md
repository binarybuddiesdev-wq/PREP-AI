# Concurrent Question Uniqueness Design

## Intent

Prevent two admin requests from creating identical questions in the same topic
and difficulty when they race, including requests that use different
`Idempotency-Key` values. Preserve the existing exact-text duplicate semantics.

## Approaches

1. **Unique compound index over question fields.** It is simple, but indexing
   unbounded question text risks MongoDB's index-key size limit and existing
   duplicates can make index creation fail.
2. **Unique hash claim per question (chosen).** A fixed-length SHA-256 key for
   `(topicId, difficulty, exact question text)` is stored in an additive Mongo
   collection and claimed in the same transaction as each question mutation.
   Existing records are populated by a retryable backfill command.
3. **Keep application-side duplicate checks only.** This avoids rollout work,
   but the current read-before-write race remains.

## Behavior

- Compute the uniqueness key from `(canonical lowercase topicId, difficulty,
exact question text)`; `referenceAnswer` is not part of uniqueness. Lowercase
  ObjectId normalization makes equivalent Mongo IDs share the same claim.
- A unique fingerprint claim is created transactionally with a new question.
  A conflicting claim maps to the existing HTTP 409 duplicate-question error.
- Question edits transactionally release the old claim and claim the new tuple.
  Edits that produce a tuple already owned by another question return HTTP 409
  and keep the original question and claim unchanged.
- Question deletion transactionally removes its claim and question. Repeated
  deletes remain successful.
- Update transactions read the latest question state on every retry and retry
  transient Mongo write conflicts up to two times. Canonical IDs returned from
  the database are used for claim movement and cleanup.
- The seed upsert creates each new question and its claim in one transaction;
  reruns also repair a missing claim for an existing seed question.
- The existing sequential duplicate lookup remains for clear behavior and
  legacy detection.
- A backfill command first scans the full existing question set for duplicate
  tuples and conflicting claim records. It reports conflicts and writes nothing
  if source questions contain duplicates. Otherwise it idempotently creates
  claims and removes stale claims, so it can be safely rerun after interruption.
- Rollout requires applying the Mongo Prisma schema, pausing question writes
  while running the backfill, then deploying/enabling the claim-aware service.

## Constraints and non-goals

- Do not alter public question response shapes or duplicate error status/message.
- Do not normalize question-text case, punctuation, or whitespace; matching
  remains exact. Normalize only ObjectId casing in `topicId`.
- Do not include reference answers in the unique key.
- Do not change the staged PostgreSQL RLS rollout.

## Verification

Unit tests cover fingerprint inputs, duplicate claims, update rollback on a
collision, update retries, seed claim repair, claim cleanup on delete, and
backfill duplicate detection/retry. Mongo-backed tests prove concurrent
different-key creates persist one question and one claim, and competing edits
cannot claim the same tuple. Run the full server gate, database isolation
suite, architecture viewer check, and diff check.
