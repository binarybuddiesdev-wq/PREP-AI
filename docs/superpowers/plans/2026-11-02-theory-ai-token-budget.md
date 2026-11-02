# Theory AI token budget implementation plan

> Follow TDD: add a failing test, observe the expected failure, implement, then rerun the owning suite.

**Spec:** `docs/superpowers/specs/2026-11-02-theory-ai-token-budget.md`

## Tasks

1. [x] Add role-limit and Redis Lua tests for weighted reservations, daily TTL, cap enforcement, settlement, and malformed responses. Implement shared quota primitives.
2. [x] Add a budget service that resolves the account role, calculates the UTC-day quota and fails closed on Redis errors. Test free/premium limits and dependency failures.
3. [x] Add failing theory-evaluation tests for pre-call reservation, actual token settlement, failover charging, quota denial and Redis failure. Integrate the budget with the existing worker lifecycle and clamp model output tokens.
4. [x] Document defaults and failure behavior in environment/config and architecture docs. The focused suite, full server gate, PostgreSQL schema validation and architecture checks pass; no live provider calls were made.
