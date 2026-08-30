# PrepAI Architecture

> **Source of truth for PrepAI's system design.** All diagrams are
> [Mermaid](https://mermaid.js.org/) and render natively on GitHub — no
> special viewer required. The standalone HTML viewer at
> [`viewer.html`](viewer.html) remains as a sandbox for experimentation
> and offline viewing.

---

## How this is organized

We follow the pattern used at large engineering orgs (Google, Microsoft,
Stripe, Spotify):

1. **C4 model** for architecture — context, containers, components.
2. **Sequence diagrams** for the critical user flows.
3. **ADRs** for every meaningful decision (why we picked X over Y).
4. **Service catalog** for ownership and SLOs.
5. **NFRs doc** for the numbers every architecture decision must cite.

All under `docs/`. Every change goes through a PR.

---

## Diagrams

### C4 — system context, containers, components

| Level | File | What it shows |
|---|---|---|
| L1 | [c4-01-context.mmd](diagrams/c4-01-context.mmd) | PrepAI, the users, and external systems (Clerk, NVIDIA NIM, Cloudinary, Resend, Razorpay) |
| L2 | [c4-02-container.mmd](diagrams/c4-02-container.mmd) | Process boundaries: SPA, API, Mongo, Postgres, Redis, Piston, Mastra |
| L3 | [c4-03-component.mmd](diagrams/c4-03-component.mmd) | NestJS modules, guards, interceptors, infrastructure services |
| L3 | [c4-04-frontend-component.mmd](diagrams/c4-04-frontend-component.mmd) | Frontend (ui/) 7-layer N-Tier model — pages is the only layer that imports from data/ and logic/. Enforced by the `architect-review` skill. |

### Sequence flows

| File | What it shows |
|---|---|
| [seq-01-auth-webhook.mmd](diagrams/seq-01-auth-webhook.mmd) | User signs up → Clerk webhook → Svix verify → Mongo upsert → first API call |
| [seq-02-theory-ai-scoring.mmd](diagrams/seq-02-theory-ai-scoring.mmd) | Start session → Redis quota check → BullMQ enqueue → AI eval → score persists |
| [seq-03-piston-sandbox.mmd](diagrams/seq-03-piston-sandbox.mmd) | Submit code → Piston execute → BullMQ code review → complexity analysis |

---

## Decisions

See [../adr/](../adr/) for the full index. Highlights:

- [ADR-0001: Polyglot persistence](../adr/0001-polyglot-persistence.md) — why two databases
- [ADR-0002: Clerk webhook](../adr/0002-clerk-webhook-vs-lazy-create.md) — why webhook, not lazy create
- [ADR-0003: pgvector](../adr/0003-pgvector-for-rag.md) — why pgvector, not Pinecone
- [ADR-0004: BullMQ](../adr/0004-bullmq-for-async-jobs.md) — why a queue, not in-process promises
- [ADR-0005: Redis quota](../adr/0005-redis-quota-counters.md) — why atomic INCR+EXPIRE
- [ADR-0006: Defer Firecracker](../adr/0006-defer-firecracker-isolation.md) — accepted v1 risk
- [ADR-0007: Groq LLM fallback](../adr/0007-add-groq-as-llm-fallback.md) — multi-provider failover routing
- [ADR-0008: Frontend N-Tier](../adr/0008-frontend-n-tier.md) — 7-layer model with Reader/Command hooks

---

## Service catalog

[services.md](services.md) — every service, its owner, SLO, dependencies, and runbook link.

## Glossary of Technical Terms

[terms-glossary.md](terms-glossary.md) — plain English explanations of all system design terms with real-world analogies.

---

## Non-functional requirements

[nfrs.md](nfrs.md) — latency, availability, throughput, capacity, retention, security, cost, observability, DR.

---

## Conventions

- **Diagram format:** Mermaid (`.mmd`). Edit in the repo, never in a
  WYSIWYG tool. Render via GitHub's built-in support.
- **Diagram size:** if a diagram exceeds ~30 nodes, split it.
- **Naming:** `c4-NN-name.mmd` or `seq-NN-name.mmd`. Number sequentially
  in the order they appear in the README index.
- **Style:** dark theme, brand colors (`#6366f1`, `#312e81`).
- **Don't duplicate** a diagram already on the README or in an ADR — link
  to it.

---

## Related docs

- [architecture.md](architecture.md) — **Master Software Architecture & System Design Blueprint** (Hexagonal modular monolith, dual Prisma ORM, Mastra AI failover routing, Piston execution sandbox, N-Tier CQRS layer boundaries, testing gates).
- [frontend-refactor.md](frontend-refactor.md) — **Frontend N-Tier Refactor Plan & Playbook** (Granular 7-layer migration plan, Reader/Command hook patterns, file inventory).
- [TODO.md](TODO.md) — **explicit list of architecture docs that are NOT YET
  WRITTEN**. Read this before assuming the system design is complete.
- [SYSTEM_DESIGN_REVIEW.md](../../SYSTEM_DESIGN_REVIEW.md) — the design
  review that produced the action items in this folder
- [../../Decisions/](../../Decisions/) — earlier product/UX decision docs
  (DECISIONS-1, DECISIONS-2) — keep these, they're the pre-ADR history
- [../PISTON_WSL_SETUP_GUIDE.md](../PISTON_WSL_SETUP_GUIDE.md) — Piston
  setup; see ADR-0006 for the isolation posture
- [viewer.html](viewer.html) — standalone HTML viewer (uses the same
  diagrams as embedded Mermaid blocks; auto-generated from `diagrams/*.mmd`
  by `pnpm build:viewer`)
- [BUILDING.md](BUILDING.md) — **operator's manual**: how to edit diagrams,
  add ADRs, run the build script, and the checklist for AI agents making
  architecture changes
