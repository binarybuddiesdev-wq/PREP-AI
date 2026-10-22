# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PrepAI is an AI-powered interview preparation platform (adaptive questions, AI-scored answers, weakness tracking, coding challenges). It's a monorepo with three independently-managed pnpm packages:

- `server/` — NestJS (v11) + Fastify backend. Its own commands, architecture notes and skills: **[`server/CLAUDE.md`](server/CLAUDE.md)**.
- `ui/` — React 19 + Vite frontend. Its own commands, architecture notes and skills: **[`ui/CLAUDE.md`](ui/CLAUDE.md)**.
- root — Playwright E2E tests, the shared tooling (ESLint, Prettier, Husky, commitlint, CI) and Piston (code execution engine) management scripts.

There's also `piston-cli/` (installs Piston language runtimes) and `types/piston.ts` (start/stop/setup/status script for the self-hosted Piston container), and a standalone `prepai-ui.html` — a fully self-contained static HTML prototype of the whole UI with no backend/build step; don't confuse it with the real `ui/` app.

**The two stacks are kept separate on purpose.** Backend and frontend each have their own skills, gate and agents, duplicated where needed and tuned to their stack. Only what is genuinely common lives at the root: this file, the commit and PR-review skills, the cross-cutting `architect` agent, and the shared scripts. A change that touches both packages follows both sets of rules.

## Commands

Install everything (each package has its own lockfile):

```bash
pnpm install
cd ui && pnpm install && cd ..
cd server && pnpm install && cd ..
```

Per-package commands (build, test, Prisma, dev server) are in [`server/CLAUDE.md`](server/CLAUDE.md) and [`ui/CLAUDE.md`](ui/CLAUDE.md). From the repo root:

```bash
pnpm lint              # eslint . (root flat config for server/ and ui/) — what CI runs
pnpm format:check      # prettier --check — what CI runs. `pnpm format` WRITES files; the gate never uses it
pnpm commitlint        # validate a commit message
pnpm seed              # seed MongoDB topics + questions (idempotent; local database only)
```

### Piston (self-hosted code execution engine, from repo root)

```bash
pnpm piston:start    # create (first run) or `podman start` the piston_api container
pnpm piston:setup    # install JS/TS/Python runtimes — run once (persist in piston_data volume)
pnpm piston:status
pnpm piston:stop     # `podman stop` — container is kept (Exited), restart with piston:start
pnpm piston:remove   # `podman rm -f` — delete the container entirely (e.g. to recreate with new flags)
```

Requires Podman Desktop running. Verify with `podman ps` and `curl http://127.0.0.1:2000/api/v2/runtimes`. Container binds explicitly to `127.0.0.1:2000` to avoid Windows port-forwarding issues. Troubleshooting details in `docs/PISTON_WSL_SETUP_GUIDE.md`; port is changed in `types/piston.ts`. On Podman 6.x + WSL 2.7+ a fresh clone also needs: `.sh` files kept LF (`.gitattributes`), WSL2 `networkingMode=mirrored` in `%USERPROFILE%\.wslconfig`, and the `--add-host` GitHub-CDN pins already in `types/piston.ts` — see §2b of the guide. Runtimes persist in the `piston_data` volume, so `pnpm piston:setup` is one-time.

### E2E (Playwright, from repo root)

```bash
pnpm test              # all E2E tests (Playwright; its webServer config runs `pnpm dev` in ui/ and server/)
pnpm test:ui            # Playwright project `ui` only
pnpm test:server        # Playwright project `server` only
pnpm test:chromium      # *-chromium projects only
pnpm report             # open HTML report
```

`server/` has no `dev` script (it is `start:dev`), so start the backend yourself before running these; `reuseExistingServer` picks it up locally.

## Architecture

> **Read these first when you need to understand the system:**
>
> - [`docs/architecture/README.md`](docs/architecture/README.md) — diagram + ADR index
> - [`docs/architecture/services.md`](docs/architecture/services.md) — service catalog with owners and SLOs
> - [`docs/architecture/nfrs.md`](docs/architecture/nfrs.md) — quantified non-functional requirements
> - [`docs/architecture/terms-glossary.md`](docs/architecture/terms-glossary.md) — technical terms explained in simple English
> - [`docs/architecture/TODO.md`](docs/architecture/TODO.md) — **list of architecture docs still to be written** (caching, queues, AI pipeline, RAG, runbooks, threat model, etc.)
> - [`docs/adr/`](docs/adr/) — every meaningful design decision and why
> - [`docs/architecture/viewer.html`](docs/architecture/viewer.html) — standalone interactive diagram viewer
>
> Before making any non-trivial architecture change (new service, new datastore, new
> dependency, accepted tech debt), read the relevant ADRs and the NFRs doc, check
> [TODO.md](docs/architecture/TODO.md) for related pending work, and add a new ADR
> with the same PR.

### Where the stack rules live

Backend rules (two databases, modules, auth, the response envelope, constants, logging and config, ESM imports, Mastra) are in [`server/CLAUDE.md`](server/CLAUDE.md). Frontend rules (routing, state, the API client, styling, the 7-layer target) are in [`ui/CLAUDE.md`](ui/CLAUDE.md). They load when you work in that directory.

## Agent Skills & Guidelines

Every AI assistant MUST read and strictly adhere to the corresponding skill before creating, modifying, or reviewing code in that domain. Skills are split by who they belong to:

- **Shared**, in [`.claude/skills/`](.claude/skills/): visible everywhere.
- **Server**, in [`server/.claude/skills/`](server/.claude/skills/): listed only after a file under `server/` has been read or edited.
- **UI**, in [`ui/.claude/skills/`](ui/.claude/skills/): listed only after a file under `ui/` has been read or edited.

**Stack skills load lazily.** Before invoking one, read a relevant file in that directory first (the page, component, controller or service you are about to change), then invoke the skill. If it is not listed yet, you have not touched that directory yet: read a file there; do not proceed without it. Each stack's `CLAUDE.md` has a when-to-invoke table.

**Shared**

- **[`git-commit`](.claude/skills/git-commit/SKILL.md):** Conventional Commits format, the registered scopes in `commitlint.config.js`, and the husky `commit-msg` hook. Required before any `git commit`, and only when the user asks for a commit.
- **[`pr-review`](.claude/skills/pr-review/SKILL.md):** Runs the stack architect-review skill(s) against a GitHub PR in an isolated worktree, then posts findings as inline PR review comments via `gh`.

**Server** (`server/.claude/skills/`)

- **[`server-developer`](server/.claude/skills/server-developer/SKILL.md):** Backend baseline: process, impact analysis, failure handling, security authoring, naming, testing principles.
- **[`nestjs-developer`](server/.claude/skills/nestjs-developer/SKILL.md):** NestJS architecture, module wiring, Fastify types, guards, Pino logging, dependency injection.
- **[`api-design`](server/.claude/skills/api-design/SKILL.md):** Endpoints, DTOs, the `{success, message, data}` envelope, status codes, the API contract and its UI impact.
- **[`prisma-database`](server/.claude/skills/prisma-database/SKILL.md):** The Mongo/Postgres split, query patterns, user scoping (IDOR), the `client_` no-op.
- **[`db-schema-change`](server/.claude/skills/db-schema-change/SKILL.md):** Changing a schema, index, backfill or seed safely when data exists.
- **[`mastra-ai`](server/.claude/skills/mastra-ai/SKILL.md):** Mastra agents, the NVIDIA/Groq failover router, Zod structured outputs, prompt-injection rules.
- **[`testing`](server/.claude/skills/testing/SKILL.md):** Vitest specs, `vi.fn()` mocking, guard overrides, coverage thresholds, and what mocked specs cannot prove.
- **[`server-verify-implementation`](server/.claude/skills/server-verify-implementation/SKILL.md):** The tiered server gate (lint, format check, build, spec type-check, tests, coverage).
- **[`server-upgrade-packages`](server/.claude/skills/server-upgrade-packages/SKILL.md):** Breaking-change analysis and approval for server dependencies.
- **[`server-architect-review`](server/.claude/skills/server-architect-review/SKILL.md):** Read-only review of a `server/` change: gate, mandatory walk, judgment gates, default correctness pass.

**UI** (`ui/.claude/skills/`)

- **[`ui-developer`](ui/.claude/skills/ui-developer/SKILL.md):** Frontend baseline: process, impact analysis, failure handling, security authoring, naming, testing principles.
- **[`react-developer`](ui/.claude/skills/react-developer/SKILL.md):** Components, pages, hooks, file structure, naming, memoization, Tailwind and shadcn, accessibility, and the known backlog.
- **[`frontend-data-fetching`](ui/.claude/skills/frontend-data-fetching/SKILL.md):** `useApiClient`, TanStack Query, query keys, mutations, loading/error/empty states.
- **[`frontend-testing`](ui/.claude/skills/frontend-testing/SKILL.md):** Vitest + Testing Library, mocking Clerk and the API client, and the traps in this repo's setup.
- **[`ui-verify-implementation`](ui/.claude/skills/ui-verify-implementation/SKILL.md):** The tiered frontend gate (lint, format check, type-check, build, tests, a look at the running screen).
- **[`ui-upgrade-packages`](ui/.claude/skills/ui-upgrade-packages/SKILL.md):** Breaking-change analysis and approval for frontend dependencies.
- **[`ui-architect-review`](ui/.claude/skills/ui-architect-review/SKILL.md):** Read-only review of a `ui/` change: gate, mandatory walk, judgment gates, default correctness pass.

**Agents** (all in [`.claude/agents/`](.claude/agents/), because Claude Code discovers nested agent folders only when a session starts inside them): `architect` (cross-cutting: ADRs, tooling, stewardship); `backend-developer`, `backend-architect`, `backend-qa-engineer`; `frontend-developer`, `frontend-architect`, `frontend-qa-engineer`.

A guard keeps this section honest: `pnpm run check:agent-docs` fails if a skill or agent on disk is missing here, or if this file names one that does not exist.

---

## Role Dispatch

This section tells the orchestrating (main) agent when to invoke which of the seven role-based subagents defined in [`.claude/agents/`](.claude/agents/) and which skills to invoke. Each stack has its own developer, architect and QA engineer (`backend-developer`, `backend-architect`, `backend-qa-engineer`; `frontend-developer`, `frontend-architect`, `frontend-qa-engineer`), plus one cross-cutting `architect` for ADRs, the development setup and repo-wide stewardship. A change in one stack is handled only by that stack's agents; a change touching both is split by directory ownership. Its goal is to pay the cost of subagent dispatch only where genuine judgment is needed, not on every trivial diff. There are two checkpoints, run in this order for any change:

### Checkpoint 1 — The Mechanical Gate

Also called the **Test Gate** in the agent definitions — same thing. Mechanical, no subagent dispatch, governed entirely by the stack's gate skill: [`server-verify-implementation`](server/.claude/skills/server-verify-implementation/SKILL.md) for `server/`, [`ui-verify-implementation`](ui/.claude/skills/ui-verify-implementation/SKILL.md) for `ui/` (both when a change touches both). Tier 1 runs on every change unconditionally; Tier 2 runs conditionally, when the change reaches those areas. It runs **once, on the assembled change, by the orchestrating agent**; an engineer subagent runs only the local check for its own piece. See each skill's "What changed → which checks" table for the selection rule.

**Standing instruction** (folded into `architect.md`'s responsibility 1): a recurring or rule-shaped finding from the Judgment Review gets promoted into a mechanical rule — a new ESLint rule, a stricter pre-commit hook — rather than staying a remembered instruction.

### Checkpoint 2 — The Judgment Review

Dispatched only for non-trivial changes — see the decision rule below. The table's first four rows are dispatches for direct implementation/design work; the last two rows are the after-the-fact review-gate triggers for the stack's architect and QA-engineer subagents once implementation is done.

| Task touches                                                                                                                 | Dispatch                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/**`, `server/prisma/**` (modules, controllers, services, Prisma, Mastra, config)                                 | `backend-developer`                                                                                                                                                                                                                                                                                           |
| `ui/src/**` (any frontend file or page)                                                                                      | `frontend-developer`                                                                                                                                                                                                                                                                                          |
| Writing or expanding test coverage for `server/`                                                                             | `backend-qa-engineer` (authoring mode)                                                                                                                                                                                                                                                                        |
| Writing or expanding test coverage for `ui/`                                                                                 | `frontend-qa-engineer` (authoring mode)                                                                                                                                                                                                                                                                       |
| Pre-implementation analysis of a non-trivial `server/` feature                                                               | `backend-architect` (analysis mode)                                                                                                                                                                                                                                                                           |
| Pre-implementation analysis of a non-trivial `ui/` feature                                                                   | `frontend-architect` (analysis mode)                                                                                                                                                                                                                                                                          |
| Cross-cutting decisions spanning both packages, ADRs, the development setup (ESLint, Husky, CI, `scripts/`), repo-wide drift | `architect`                                                                                                                                                                                                                                                                                                   |
| **After a _non-trivial_ `server/` implementation** (see definition below), the Mechanical Gate having already run            | `backend-qa-engineer` and/or `backend-architect`, whichever risk is present; **concurrently in one message** when both apply. Run via the `server-architect-review` skill                                                                                                                                     |
| **After a _non-trivial_ `ui/` implementation**, the Mechanical Gate having already run                                       | `frontend-qa-engineer` and/or `frontend-architect`, whichever risk is present; **concurrently in one message** when both apply. Run via the `ui-architect-review` skill                                                                                                                                       |
| **Either review gate reports an issue**                                                                                      | dispatch back to the engineer who owns that code (`backend-developer` / `frontend-developer`) to fix it; then re-review **only the flagged item and what the fix touched**, unless the fix changed behavior or structure (see below). A rule-shaped finding goes to `architect` to become a lint rule or hook |

#### What a dispatch prompt must carry

A subagent starts with **no share of the orchestrating agent's context**. Anything already established — the file list, the line numbers, the tool output, the classification of what's wrong, the decision already taken and why — must be restated in the dispatch prompt, or the subagent spends most of its run re-deriving it. This is the single largest avoidable cost in the dispatch model, and it multiplies with every agent in a parallel fan-out: N agents rediscovering the same facts N times.

Every dispatch prompt states:

1. **The concrete work list** — exact paths and line numbers, not "the files with lint errors". If the orchestrating agent already ran the tool that produces the list, paste the relevant slice of that output.
2. **What has already been decided, and why** — the approach, the rejected alternatives, and any user decision that constrains the work. Without this a subagent re-litigates settled choices, or quietly picks a different one.
3. **The scope boundary** — what this agent owns and what a _concurrent_ agent owns. When fanning out, name the files each agent must not touch. Shared files (a barrel, a config, a shared helper) belong to exactly one agent; say which.
4. **Prerequisites and their owner** — if the task depends on something another agent in the same batch is creating, say so explicitly rather than letting each assume someone else did it.
5. **The verification to run, and the expected result** — the Mechanical Gate commands plus the number the agent should reach.
6. **The skills to load.** Name them, and tell the agent to read a file in its area first: skills under `ui/.claude/skills/` and `server/.claude/skills/` are not listed until a file there has been read or edited. An engineer agent that is not told which skills apply may skip them.
7. **For `backend-qa-engineer` / `frontend-qa-engineer`, the mode** — review (report only) or authoring (test files only). They assume review if none is stated. The architects likewise take a mode: review or analysis.
8. **For any review dispatch, `<base>` and the explicit base and head SHAs.** `<base>` is `main`; a subagent never assumes a branch name and never resolves its own range.

When fanning out, prefer splitting by **directory ownership** over splitting by task type — it makes the boundaries in (3) self-evident and keeps two agents off the same file.

#### Trivial vs. non-trivial decision rule

A concrete rule for the orchestrating agent to apply, not "use judgment":

- **Trivial** (Mechanical Gate only, no subagent dispatch) — single-file, no new/changed public interface, exported type, DTO, or ADR-relevant decision; no new pattern introduced. Examples: renames, typo/wording fixes, single-conditional or single-log-line fixes, config value tweaks, a bug fix that doesn't change a function's contract.
- **Mechanical sweep** (Mechanical Gate only, no subagent dispatch, **regardless of file count**) — the same known-correct edit repeated across many files, introducing no new interface, pattern, or behavior. The test for this class: _is correctness decided by mechanical ground truth?_ If "lint is silent, types check, tests pass" fully establishes the change is right, a judgment agent has nothing left to judge. Examples: conforming to a newly enabled lint rule, a repo-wide rename, replacing an inline stub with an existing shared helper, extracting a stateless private method to a module-level function with unchanged behavior.
  - **File count is not a risk signal — design novelty is.** An 80-file substitution of one identical expression carries less risk than a four-line change to error handling in two files. Route novelty and behavior change to the Judgment Review, not breadth.
  - This class does **not** absorb a change that alters behavior, even by one line. If a sweep turns up a genuine defect along the way (a swallowed error, a missing edge case), that specific fix is non-trivial on its own and gets the full Judgment Review — split it out of the sweep rather than reclassifying the whole sweep.
- **Non-trivial** (Judgment Review applies) — anything that adds or changes an endpoint, DTO, status code, message or response shape; a Prisma model, field or index; a guard, interceptor, Mastra agent or prompt; user scoping or role rules; an exported component, hook or type; a route, a Redux slice, `service/api/` or a query key; introduces a pattern not already used elsewhere in that layer; changes behavior, error handling, or a public contract; any new feature work regardless of size; any `ui/` change beyond a one-line fix.
- When genuinely ambiguous, default to non-trivial (dispatch) — a wasted Judgment Review pass costs far less than a missed regression. But "spans multiple files" alone is **not** that ambiguity: apply the Mechanical sweep test first.

#### Which gate, and why they run concurrently

Both gates read the Mechanical Gate's already-produced output, and **neither re-runs the suite.** Because that output already exists before either is dispatched, the architect is not waiting on anything the QA engineer produces — serializing them buys no information and doubles the latency. Each reports independently; the orchestrating agent merges the two reports.

Dispatch only the gate whose risk is actually present:

- **The stack's QA engineer alone** when the risk is coverage — new or changed logic whose tests are thin, or a change whose regression surface is wider than the diff.
- **The stack's architect alone** when the risk is design — a new pattern, a layer-boundary question, or an oversized component in an already well-tested path. Run it through that stack's review skill ([`server-architect-review`](server/.claude/skills/server-architect-review/SKILL.md) or [`ui-architect-review`](ui/.claude/skills/ui-architect-review/SKILL.md)), which encodes the checklist and the report format.
- **Both, concurrently,** when both apply, or when genuinely unsure which. But "it's non-trivial" is not by itself a reason to dispatch both.

This replaces an earlier QA-engineer → architect ordering whose stated purpose was to catch a broken build before reasoning about architecture on top of it. The Mechanical Gate already catches that, upstream of both — so do not reintroduce the ordering as an apparent improvement.

#### Fix-and-re-review mechanics

Neither review gate is a dead end, and neither silently patches around what it finds. When either flags something, the fix belongs to whichever engineer subagent owns that code — `backend-developer` for `server/`, `frontend-developer` for `ui/`. The only work a review-gate agent does directly: the QA engineers may write a genuinely missing _test_ (test-only, not a production fix); the cross-cutting `architect` may write/update an ADR or a dev-setup/tooling file (its own domain, and the preferred outcome whenever a finding is rule-shaped). An actual implementation defect — bug, missed edge case, oversized component, principle violation — always goes back to the owning engineer.

**Scope the re-review to the fix.** Re-run the Mechanical Gate always. Then:

- **Fix confined to what was flagged** (a rename, an added guard, a split component, a new test) — re-review only that item and the files the fix touched, and only by the gate that raised it. A naming nit does not justify a second full pass of both gates.
- **Fix changed behavior, a public contract, or structure beyond the flagged site** — re-run both gates in full, concurrently. Widening the blast radius is exactly what the full pass exists for.

The orchestrating agent runs this loop, not the subagents — none of the agent definitions in `.claude/agents/` have `Agent`-tool access, so they cannot dispatch each other directly. Each subagent returns its findings as its final report; whichever agent dispatched the original engineer (typically the main loop) reads that report and re-dispatches the fix.

#### Convergence bound

If the same category of issue survives 2 fix-and-re-review cycles (e.g. a stack architect flags the same principle violation twice after two attempted fixes), stop looping automatically and surface it to the user instead of continuing indefinitely. There is no unbounded "repeat until clean" loop.

#### Known gap

Nobody reviews the cross-cutting `architect`'s own direct edits (an ADR, an `eslint.config.js` change); a change to a gate or lint rule is reviewed by the relevant QA engineer as a tooling change. This is a real limitation, not an implied guarantee of oversight everywhere.
