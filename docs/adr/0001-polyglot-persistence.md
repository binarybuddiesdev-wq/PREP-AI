# ADR-0001: Polyglot persistence — MongoDB + PostgreSQL

## Status

Accepted, 2026-08-29

## Context

PrepAI stores both content (Users, Topics, Questions, PdfSource metadata) and
transactional data (Practice sessions, answers, payments, AI eval jobs). These
two data categories have different access patterns:

- **Content data** is read-heavy, write-rare, schema-evolving, document-shaped
  (User has nested `settings`, Question has nested `referenceAnswer`).
- **Transactional data** is write-heavy, time-series-ish, join-heavy, with
  aggregations (weekly score trend, daily-solved count, weak-area rollup).

A single database forces one set of tradeoffs on both. We could pick either
but neither is great: Mongo's aggregation framework is awkward for joins;
Postgres' JSONB works but loses tooling maturity for nested-document reads.

## Decision

We will run **two databases**:

| Store                                                     | Data                                                                                                                                                 | Why                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **MongoDB** (via `PrismaService`)                         | `User`, `UserSettings`, `Topic`, `Question`, `PdfSource`                                                                                             | Flexible schema, nested docs read in one query, easy evolution      |
| **PostgreSQL + pgvector** (via `PrismaPostgresqlService`) | `TheorySession`, `TheoryAnswer`, `CodingSession`, `CodingAnswer`, `Payment`, `Job`, `IdempotencyKey`, `AuditLog`, `UserWeaknessSnapshot`, embeddings | Joins, aggregations, transactions, pgvector for RAG, mature tooling |

Cross-store references are string IDs (Clerk user ID, our own UUIDs). We do
not do cross-store joins; data that needs both is read twice and joined in
the service layer.

## Consequences

**Easier:**

- Each store uses the right tool for its access pattern
- Postgres + pgvector gives us a single store for transactional data AND vectors
- Schema evolution in Mongo is friction-free
- SQL aggregations for analytics are straightforward

**Harder:**

- Two connection pools, two ORM clients, two schema migrations
- No atomic cross-store transaction (e.g., "user paid, upgrade role" must
  use the outbox pattern)
- Two backup strategies, two runbooks
- Devs need to know both SQL and document-query idioms

## Alternatives considered

- **Postgres only, with JSONB for content.** Rejected: tooling for nested
  document reads is weaker; we'd end up with the worst of both worlds.
- **Mongo only.** Rejected: aggregations for analytics are awkward, and we'd
  need a separate vector store later for RAG anyway.
- **DynamoDB / Cassandra.** Rejected: overkill for current scale; ops cost
  too high for a solo team.

## References

- [DAOS book, ch. 9 (Polyglot Persistence)](https://databasesdemystified.com/)
- [Shopify engineering blog: "Deconstructing the Monolith"](https://shopify.engineering/deconstructing-monolith-designing-data-microservices/)
- `Decisions/DECISIONS-1.md` §"Database Architecture"
- `docs/architecture/diagrams/c4-02-container.mmd`
