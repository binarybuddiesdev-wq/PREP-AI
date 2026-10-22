---
name: server-architect-review
description: Reviews a PrepAI change under server/ against the backend conventions by running the server Mechanical Gate, a mandatory cheap walk, the backend-architect and backend-qa-engineer judgment gates, and an unconditional default correctness pass. Use before merging a server branch or when asked to review backend changes. Read-only.
---

# Architect Review (server)

A read-only review of a change under `server/` against `nestjs-developer`, `api-design`, `prisma-database`, `db-schema-change`, `mastra-ai` and `server-developer`. The frontend has its own `ui-architect-review`; a change touching both packages runs both and presents the two reports together.

**This skill is read-only.** It reviews and reports. It never edits a repo file, never fixes what it finds and never runs the fix-and-re-review loop, so it is safe to run on any branch at any time, including someone else's.

## When to use

- Before merging a branch that touches `server/` to `main`
- Before committing a backend refactor
- Whenever you want a second pair of eyes on a backend change

## Review scope

Default: **the current branch versus `main`** (PrepAI has no `dev` branch; `git branch -a` shows only `main`).

```bash
git diff --name-only main...HEAD -- server
git diff --stat main...HEAD -- server
git log --oneline main..HEAD
```

The three-dot `main...HEAD` diffs against the merge base, so the review sees what the branch _adds_. Two dots only for `git log`.

- **Already on `main`, or zero commits ahead** — review uncommitted work: `git diff HEAD -- server` plus `git status --porcelain`. Say which fallback you took.
- **An argument overrides the default** — a path (`server/src/modules/topic`), a ref, a range, or `--staged`. State the resolved scope first.

## Process

### 1. Resolve scope

Run the commands above and keep the raw output. Note anything outside `server/` (root config, docs, `routes/`) and hand it to the right reviewer.

### 2. Run the Mechanical Gate

Invoke `server-verify-implementation`. Tier 1 always; Tier 2 by its table. Every later step reads this output rather than re-running the suite.

### 3. Run the mandatory walk (always)

Cheap, objective, answerable from the diff alone, so it runs even on a one-line change. **You run it yourself; never a subagent.** Emit a visible `Check | Result | Note` block, one row per item, before any finding:

| Check                                                                                                                | Result                               |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Naming — does a new identifier fail `server-developer` § Naming?                                                     | ✅ / ❌ (`file:line`)                |
| Comments — does a new comment restate _what_ instead of _why_?                                                       | ✅ / ❌                              |
| Envelope — does a new or changed handler return bare data instead of `{ message, data }`?                            | ✅ / ❌ / ➖ (no controller touched) |
| `.js` extensions — does a new or changed relative or `@/` import omit the extension?                                 | ✅ / ❌ / ➖                         |
| Scoping — does a new or changed Prisma query on user-owned data take the user id from `request.user` in the `where`? | ✅ / ❌ / ➖ (no query touched)      |
| Config — does the diff add a `process.env` read outside the accepted locations (`nestjs-developer` rule 8)?          | ✅ / ❌ / ➖                         |
| Failures reported, not swallowed — does a new or changed `catch` do nothing, or only log and carry on?               | ✅ / ❌ / ➖ (no catch touched)      |

`✅` checked, nothing found. `❌` a finding; it also goes in the ranked list with its full entry. `➖` does not apply, with the reason. Never silently omit a row.

### 4. Classify the change

**File count is not a risk signal; design novelty is.**

- **Trivial** — single file, no new or changed route, DTO field, status code, message, response shape, model, index or exported type; no new pattern. Renames, typo fixes, a single-conditional fix, a config value.
- **Mechanical sweep** — the same known-correct edit repeated, introducing no new interface, pattern or behaviour. The test: _is correctness decided by mechanical ground truth?_ If "lint is silent, it builds, specs pass" fully establishes it, there is nothing to judge.
- **Non-trivial** — adds or changes an endpoint, DTO, status code, user-facing message or response shape; a Prisma model, field or index; a guard, interceptor or pipe; a Mastra agent or prompt; user scoping, auth or role rules; error handling or a public contract; introduces a pattern new to the layer; any new feature work.

A trivial change or sweep still gets the mandatory walk and the default correctness pass; only the judgment gates are skipped. Say so, report the gate and walk results, and stop. Offer a forced pass; do not manufacture one. A sweep that turns up a real defect: split that fix out and treat it as non-trivial.

### 5. Dispatch the judgment gates (non-trivial only)

Dispatch `backend-architect` with the checklist in [`references/checklist.md`](references/checklist.md) and the contract in [`references/dispatch-prompt.md`](references/dispatch-prompt.md). If the change has thin spec coverage or an impact footprint wider than the diff (other callers of a changed function, shared state, a changed return shape whose consumers the diff does not show), dispatch `backend-qa-engineer` in the **same message**. Both read the gate output, so serialising them only adds latency.

### 6. Dispatch the default correctness pass (always)

Separately from step 5, dispatch one `general-purpose` subagent for **general correctness and simplification**: bugs, edge cases and needless complexity that need no architectural judgement. It runs on every review, trivial or not, and is neither conditional on the other gates finding nothing nor a substitute for them. Give it the same context, name `backend-architect`'s and `backend-qa-engineer`'s territory as already covered so it does not restate their findings, and tell it never to dispatch further subagents.

### 7. Merge the report

Merge every gate's findings and the walk block into one report in the format of [`references/report-format.md`](references/report-format.md). Never relay separate reports.

## Rules (non-negotiable)

- **Read-only, always.** Findings route to a named owner; the user decides what to fix and when.
- **Never run the fix-and-re-review loop from here.**
- **Evidence, not assertions.** Paste real gate output. Never call a gate green without it.
- **Flag only what the diff adds.** The backlog each skill lists (`process.env` in `providers.ts`, the 403 in `theory.service.ts`, `NotFoundException('Database not available')`) is not a finding on a change that did not add it.
- **Dispatch prompts are self-contained.** Assume the subagent knows nothing of this conversation; carry the review-only line verbatim.
- **State the fallback you took.**
- **All subagents go in one message.**
- **The default correctness pass is never skipped.**
- **Show your exemptions** in the report instead of silently omitting a finding.

## References

- [`references/checklist.md`](references/checklist.md) — what to flag
- [`references/dispatch-prompt.md`](references/dispatch-prompt.md) — the dispatch contract
- [`references/report-format.md`](references/report-format.md) — the report and file-shape section
- Sibling skills: `nestjs-developer`, `api-design`, `prisma-database`, `db-schema-change`, `mastra-ai`, `server-developer`, `server-verify-implementation`
