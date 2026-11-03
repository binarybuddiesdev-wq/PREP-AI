# Backend implementation tracker

Last reviewed: 2026-11-03

This is the current implementation tracker for `server/`. It summarizes what
exists in code and what remains to build or decide. It complements, rather
than replaces, the historical [worklog](WORKLOG.md) and the architecture
document checklist in [architecture/TODO.md](architecture/TODO.md).

Status meanings:

- **Done** — implemented and described by the linked API or architecture docs.
- **Partial** — a useful part is implemented; the remaining work is listed.
- **Pending** — not implemented or not yet designed.

## Implemented

| Area                          | Status  | Current capability                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime and infrastructure    | Done    | NestJS/Fastify API, MongoDB and PostgreSQL through separate Prisma clients, Redis, health/readiness checks, request logging and validation. Local and Podman run modes are documented in [development-containers.md](development-containers.md).                                                                                                                                                                                               |
| Authentication and users      | Done    | Clerk JWT authentication, Clerk user webhooks, lazy profile synchronization, current-user profile/settings/setup endpoints, and admin user lookup. There are no local login/logout endpoints. See [user API](../routes/user-api-spec.md) and [Clerk setup](clerk-setup.md).                                                                                                                                                                    |
| Topics and questions          | Done    | Authenticated reads and admin-only topic/question management. See [topics API](../routes/topics-api-spec.md) and [questions API](../routes/questions-api-spec.md).                                                                                                                                                                                                                                                                             |
| Theory practice               | Done    | Owned sessions, question retrieval, answer submission, completion, history, weak-area analysis, and score trends. Evaluation is durable and asynchronous, uses Mastra with NVIDIA/Groq failover, stores model/prompt provenance, and enforces role-based daily AI token budgets. See [theory API](../routes/theory-api-spec.md), [background jobs](architecture/background-jobs.md), and [token budget ADR](adr/0005-redis-quota-counters.md). |
| Coding practice               | Done    | Problem listing/detail, owned sessions, bounded Piston run/submit, execution status/results, completion, and paginated history. BullMQ workers persist and recover execution state. AI code review and coding analytics are not included. See [coding API](../routes/coding-api-spec.md), [background jobs](architecture/background-jobs.md), and [ADR-0010](adr/0010-bullmq-piston-execution.md).                                             |
| Queue and quota reliability   | Done    | BullMQ coding execution and theory evaluation flows, Redis-backed daily quotas, retries, idempotent result persistence, and separate worker support in the full Podman profile. More queue consumers are pending.                                                                                                                                                                                                                              |
| AI evaluation quality tooling | Partial | Mastra comparison harness and a 50-case synthetic baseline exist. Subject-matter review of labels and continued evaluation after model/prompt changes remain. See [evaluation README](../server/evaluation/README.md).                                                                                                                                                                                                                         |
| Verification                  | Done    | The full repository gate passed on 2026-11-03 for the PII-redaction change, including lint, formatting, Prisma generation, server build, spec type-check, unit tests, coverage, and agent-doc checks. Run `pnpm gate -- --stack server --level full` after changes.                                                                                                                                                                            |

## Pending implementation and design

| Work item                           | Status  | Priority | Notes / source of truth                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PII redaction for AI inputs         | Done    | High     | Theory-evaluation prompt v2 locally redacts recognized email, phone, Luhn-valid card, Aadhaar, PAN, and US SSN patterns. This is not full anonymization: names, free-form addresses, and unrecognized formats may remain. See the [AI evaluation pipeline TODO](architecture/TODO.md#3-ai-evaluation-pipeline). |
| Caching policy                      | Pending | Medium   | Decide which application data, if any, should be cached, including invalidation, TTLs, and metrics. Redis is currently used for quotas and queues, not as the source of truth. [Architecture TODO](architecture/TODO.md#1-caching-strategy).                                                                    |
| RAG and PDF ingestion               | Pending | Medium   | PDF upload/ingestion, chunking, embeddings, retrieval, citations, and re-indexing are not implemented. The pgvector direction is recorded in [ADR-0003](adr/0003-pgvector-for-rag.md); the pipeline design remains open.                                                                                        |
| Piston isolation hardening          | Partial | High     | Piston execution is implemented, but production-grade isolation and the v1 mitigation/runbook are not complete. Review [ADR-0006](adr/0006-defer-firecracker-isolation.md) and [Piston setup](PISTON_SETUP.md) before enabling public execution.                                                                |
| Cross-cutting data-isolation policy | Pending | High     | Endpoint ownership checks exist in theory and coding flows; a documented, consistently tested policy across all data access is still needed. [Architecture TODO](architecture/TODO.md#6-multi-tenancy--data-isolation).                                                                                         |
| Shared idempotency policy           | Partial | Medium   | Theory submissions and coding executions have flow-specific idempotency. Shared rules for all mutations, key scope, payload mismatch, and retention are undecided. [Architecture TODO](architecture/TODO.md#7-idempotency).                                                                                     |
| Payments and subscriptions          | Pending | Medium   | Razorpay order/subscription lifecycle, verified webhooks, reconciliation, and role changes are not implemented. [Architecture TODO](architecture/TODO.md#9-payment-state-machine).                                                                                                                              |
| Email and notifications             | Pending | Low      | Resend is present as a dependency, but no notification module/queue, preferences, templates, or unsubscribe flow is implemented. [Architecture TODO](architecture/TODO.md#10-notifications).                                                                                                                    |
| Study chatbot                       | Pending | Low      | A general study chatbot is not implemented.                                                                                                                                                                                                                                                                     |
| Operations and security docs        | Partial | High     | Observability and health checks exist. Disaster recovery/restore procedures, per-service runbooks, and a STRIDE threat model remain open. See [architecture TODO](architecture/TODO.md#11-disaster-recovery) and [observability](observability.md).                                                             |
| Additional background-job consumers | Pending | Medium   | Code review, PDF ingestion, email, and payment jobs are not implemented. Current queue design is documented in [background-jobs.md](architecture/background-jobs.md).                                                                                                                                           |

## Suggested next work

1. Write the cross-cutting data-isolation and Piston isolation requirements
   before expanding access to user data or public code execution.
2. Design PDF ingestion and RAG against the existing pgvector decision before
   implementing those modules.

These are recommendations based on the current gaps, not a committed sequence;
update this tracker when scope or priorities change.

## Keeping this tracker current

- Update this file when backend features are completed, deferred, or newly
  selected.
- Add dated details and verification evidence to [WORKLOG.md](WORKLOG.md).
- Keep detailed architectural decisions and unresolved design gaps in
  [architecture/TODO.md](architecture/TODO.md), relevant ADRs, and module docs.
- Do not mark a feature done solely because a plan or design doc exists; verify
  the implementation and its checks first.
