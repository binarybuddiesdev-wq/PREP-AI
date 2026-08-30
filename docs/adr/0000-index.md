# Architecture Decision Records (ADRs)

> ADRs capture the **why** behind every meaningful architecture decision.
> Format: Michael Nygard's, lightly adapted. See [README.md](README.md) for
> the template and style guide.

---

## Index

| #                                            | Title                                                       | Status   | Date       |
| -------------------------------------------- | ----------------------------------------------------------- | -------- | ---------- |
| [0001](0001-polyglot-persistence.md)         | Polyglot persistence — MongoDB + PostgreSQL                 | Accepted | 2026-08-29 |
| [0002](0002-clerk-webhook-vs-lazy-create.md) | Clerk webhook (not lazy create) for user provisioning       | Accepted | 2026-08-29 |
| [0003](0003-pgvector-for-rag.md)             | pgvector (not Pinecone/Qdrant) for RAG embeddings           | Accepted | 2026-08-29 |
| [0004](0004-bullmq-for-async-jobs.md)        | BullMQ (not in-process) for background jobs                 | Accepted | 2026-08-29 |
| [0005](0005-redis-quota-counters.md)         | Redis (atomic INCR+EXPIRE) for daily quota counters         | Accepted | 2026-08-29 |
| [0006](0006-defer-firecracker-isolation.md)  | Defer Firecracker/gVisor — accept Docker isolation in v1    | Accepted | 2026-08-29 |
| [0007](0007-add-groq-as-llm-fallback.md)     | Add Groq as LLM fallback (NVIDIA primary)                   | Accepted | 2026-08-29 |
| [0008](0008-frontend-n-tier.md)              | Frontend (ui/) N-Tier layer model with Reader/Command hooks | Accepted | 2026-08-30 |

---

## How to add a new ADR

1. Copy `README.md` template to `NNNN-short-title.md` (next sequential number)
2. Fill it in. Keep under one page.
3. Update the index above in the same PR.
4. Commit. The PR review is the decision review.

## When to write an ADR

Write one when you're about to:

- Adopt a new framework, library, or service
- Change a data model in a way that affects other modules
- Take a dependency that affects ops, security, or cost
- Accept technical debt deliberately (and document when/how to pay it off)
- Supersede a previous decision (mark old `Status: Superseded by ADR-NNNN`)

Don't write one for:

- Bug fixes
- Refactors with no behavioral change
- Routine dependency upgrades
