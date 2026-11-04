# Study Chat Idempotency Retention Design

## Goal

Bound MongoDB storage for completed Study Chat idempotency response snapshots
without losing retry safety for messages already written to a conversation.

## Decision

Keep completed operation snapshots for 24 hours, matching the existing admin
idempotency snapshot window. Set `expiresAt` only when a Study Chat operation
completes; active processing claims have no expiration and remain governed by
their renewable five-minute lease. The existing hourly Mongo cleanup job also
deletes completed Study Chat operations whose `expiresAt` has passed.
For completed records created before the new field exists, cleanup uses
`updatedAt + 24 hours` as the expiry so the rollout does not leave legacy
snapshots behind indefinitely.

The conversation transcript retains an operation ID and request fingerprint
for every accepted user message. If a snapshot has been cleaned, retrying a
matching key uses that marker to recover the current conversation and saves a
fresh snapshot, without asking the model again or appending the message twice.
Deleting a conversation continues to delete all its operation records.

This is a Mongo-only schema change; apply it with
`pnpm --filter server prisma:push:mongodb` before enabling the new generated
client in an existing environment. No PostgreSQL or RLS changes are included.

## Verification

Test 24-hour expiration at operation completion, cleanup filtering to completed
expired operations, and transcript-based recovery. Run the full server gate.
