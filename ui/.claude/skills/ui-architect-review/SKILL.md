---
name: ui-architect-review
description: Reviews a PrepAI change under ui/ against the frontend conventions by running the ui Mechanical Gate, a mandatory cheap walk, the frontend-architect and frontend-qa-engineer judgment gates, and an unconditional default correctness pass. Use before merging a ui branch or when asked to review frontend changes. Read-only.
---

# Architect Review (ui)

A read-only review of a change under `ui/` against `react-developer`, `frontend-data-fetching`, `frontend-testing`, `ui-developer` and the 7-layer target in [`docs/architecture/frontend-refactor.md`](../../../../docs/architecture/frontend-refactor.md). The backend has its own `server-architect-review`; a change touching both packages runs both and presents the two reports together.

**This skill is read-only.** It reviews and reports. It never edits a repo file, never fixes what it finds and never runs the fix-and-re-review loop, so it is safe to run on any branch at any time, including someone else's.

## When to use

- Before merging a branch that touches `ui/` to `main`
- Before committing a frontend refactor (catches layer violations early)
- Whenever you want a second pair of eyes on a frontend change

## Review scope

Default: **the current branch versus `main`** (PrepAI has no `dev` branch; `git branch -a` shows only `main`).

```bash
git diff --name-only main...HEAD -- ui
git diff --stat main...HEAD -- ui
git log --oneline main..HEAD
```

The three-dot `main...HEAD` diffs against the merge base, so the review sees what the branch _adds_. Two dots only for `git log`.

- **Already on `main`, or zero commits ahead** — review uncommitted work: `git diff HEAD -- ui` plus `git status --porcelain`. Say which fallback you took.
- **An argument overrides the default** — a path (`ui/src/pages`), a ref, a range, or `--staged`. State the resolved scope first.

## Process

### 1. Resolve scope

Run the commands above and keep the raw output. Note anything outside `ui/` (root config, docs) and hand it to the right reviewer.

### 2. Run the Mechanical Gate

Invoke `ui-verify-implementation`. Tier 1 always; Tier 2 by its table. Every later step reads this output rather than re-running the suite.

### 3. Run the mandatory walk (always)

Cheap, objective, answerable from the diff alone, so it runs even on a one-line change. **You run it yourself; never a subagent.** Emit a visible `Check | Result | Note` block, one row per item, before any finding:

| Check                                                                                                                                 | Result                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Naming — does a new identifier fail `ui-developer` § Naming?                                                                          | ✅ / ❌ (`file:line`)             |
| Comments — does a new comment restate _what_ instead of _why_?                                                                        | ✅ / ❌                           |
| Props interface — does a new component inline its props type, or name it without the `I` prefix (`IHelloProps` in `Hello.types.ts`)?  | ✅ / ❌ / ➖ (no component added) |
| New component shape — named export, arrow function, one component per file, `PascalCase.tsx`?                                         | ✅ / ❌ / ➖                      |
| API access — does the diff call `fetch` or `ky` directly instead of `useApiClient()`?                                                 | ✅ / ❌ / ➖                      |
| Failures reported, not swallowed — does a new or changed `catch` / `.catch(` do nothing, only `console`, or leave a loading flag set? | ✅ / ❌ / ➖ (no catch touched)   |
| Memoization — is a new `memo()` paired with reference-stable props at its callers?                                                    | ✅ / ❌ / ➖                      |

`✅` checked, nothing found. `❌` a finding; it also goes in the ranked list with its full entry. `➖` does not apply, with the reason. Never silently omit a row.

### 4. Classify the change

**File count is not a risk signal; design novelty is.**

- **Trivial** — single file, no new or changed exported component, hook, type or prop, no new route or state slice, no new pattern. Renames, typo fixes, a single-conditional fix, a class tweak.
- **Mechanical sweep** — the same known-correct edit repeated, introducing no new interface, pattern or behaviour. The test: _is correctness decided by mechanical ground truth?_ If "lint is silent, it builds, tests pass" fully establishes it, there is nothing to judge.
- **Non-trivial** — adds or changes an exported component, hook or type; a route; a Redux slice; `service/api/` or a query key; Clerk gating; introduces a pattern new to that area; changes behaviour, error handling or the backend contract it depends on; any new feature work.

A trivial change or sweep still gets the mandatory walk and the default correctness pass; only the judgment gates are skipped. Say so, report the gate and walk results, and stop. Offer a forced pass; do not manufacture one. A sweep that turns up a real defect: split that fix out and treat it as non-trivial.

### 5. Dispatch the judgment gates (non-trivial only)

Dispatch `frontend-architect` with the checklist in [`references/checklist.md`](references/checklist.md) and the contract in [`references/dispatch-prompt.md`](references/dispatch-prompt.md). If the change has thin test coverage or an impact footprint wider than the diff (other importers of a changed component, shared query keys, a changed prop shape), dispatch `frontend-qa-engineer` in the **same message**. Both read the gate output, so serialising them only adds latency.

### 6. Dispatch the default correctness pass (always)

Separately from step 5, dispatch one `general-purpose` subagent for **general correctness and simplification**: bugs, edge cases and needless complexity that need no architectural judgement. It runs on every review, trivial or not, and is neither conditional on the other gates finding nothing nor a substitute for them. Give it the same context, name `frontend-architect`'s and `frontend-qa-engineer`'s territory as already covered so it does not restate their findings, and tell it never to dispatch further subagents.

### 7. Merge the report

Merge every gate's findings and the walk block into one report in the format of [`references/report-format.md`](references/report-format.md). Never relay separate reports.

## Rules (non-negotiable)

- **Read-only, always.** Findings route to a named owner; the user decides what to fix and when.
- **Never run the fix-and-re-review loop from here.**
- **Evidence, not assertions.** Paste real gate output. Never call a gate green without it. For a visible change, say whether the screen was actually run.
- **Flag only what the diff adds.** The backlog `react-developer` lists (default-exported pages, `fetch` in `SettingsPage`, the placeholder store) is not a finding on a change that did not add it.
- **The 7 layers are a target, not yet the code.** Apply layer checks only to layers whose folders exist (`references/checklist.md`).
- **Dispatch prompts are self-contained.** Assume the subagent knows nothing of this conversation; carry the review-only line verbatim.
- **State the fallback you took.**
- **All subagents go in one message.**
- **The default correctness pass is never skipped.**
- **Show your exemptions** in the report instead of silently omitting a finding.

## References

- [`references/checklist.md`](references/checklist.md) — what to flag
- [`references/dispatch-prompt.md`](references/dispatch-prompt.md) — the dispatch contract
- [`references/report-format.md`](references/report-format.md) — the report and file-shape section
- Sibling skills: `react-developer`, `frontend-data-fetching`, `frontend-testing`, `ui-developer`, `ui-verify-implementation`
