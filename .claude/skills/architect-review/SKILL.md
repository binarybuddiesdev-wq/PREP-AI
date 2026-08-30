---
name: architect-review
description: Reviews a frontend (ui/) change against the 7-layer architecture by running the Mechanical Gate and dispatching the architect judgment gate. Flags layer violations, naming issues, and structural defects. Read-only.
---

# Architect Review (UI)

Runs a read-only review of frontend (`ui/`) changes against the architecture
defined in [`docs/architecture/architecture.md`](../../../docs/architecture/architecture.md) §Frontend Refactor
(the 7-layer N-Tier model: `core` → `utils` → `data` → `service` →
`logic` → `components` → `pages`). The Mechanical Gate runs first (via
`verify-implementation`); if the change is non-trivial, the architect
judgment gate runs second and produces a ranked list of findings.

**This skill is read-only.** It reviews and reports. It never edits a repo
file, never fixes what it finds, and never runs the fix-and-re-review loop —
so it is safe to run on any branch at any time, including someone else's.

## When to use

- Before merging a `ui/` feature branch to `dev` (or `main`)
- Before committing a `ui/` refactor (catches layer violations before they ship)
- Any time you want a second pair of eyes on a `ui/` change

If the change is **backend-only** (`server/`, Prisma, Mastra, Piston), this
skill is not the right gate. Backend changes use `nestjs-developer` for the
mechanical review.

## Review scope

Default: **the current branch versus `dev` (or `main`).**

```bash
git diff --name-only dev...HEAD
git diff --stat dev...HEAD
git log --oneline dev..HEAD
```

The three-dot `dev...HEAD` is deliberate — it diffs against the merge base,
so the review sees what this branch *adds* and not what the base moved on to
independently. Use two dots (`dev..HEAD`) only for `git log`, where it
already means "commits on HEAD not on dev".

**Filter to frontend paths only.** This skill only reviews `ui/` changes.
Discard backend paths (anything under `server/`, `piston/`, `e2e/`,
`prisma/`, etc.) from the diff before classifying.

**Two fallbacks and one override:**

- **Already on `dev`, or zero commits ahead of it** — review uncommitted
  work instead: `git diff HEAD` for tracked changes plus `git status
  --porcelain` for untracked files. Say which fallback you took.
- **An argument overrides the default** — accept a path (`ui/src/pages`),
  a ref, a commit range (`abc123..def456`), or `--staged`. Resolve it and
  state the resolved scope before proceeding.

## Process

### 1. Resolve scope

Run the three commands above (or the fallback/override equivalent) and
keep their raw output — steps 2 and 4 both need it verbatim, not
paraphrased. Filter the file list to `ui/**` only.

### 2. Run the Mechanical Gate

Invoke the `verify-implementation` skill. Tier 1 always (format, build,
test). Tier 2 (`pnpm test:e2e`, `pnpm test:coverage`) only if the change
reaches those areas. The skill's "What changed → which tiers" table
decides.

The judgment gate in step 4 reads this output rather than re-running the
suite, so it must exist before the gate is dispatched.

### 3. Classify the change

Apply the decision rule below. **File count is not a risk signal — design
novelty is.**

- **Trivial** — single-file, no new/changed public hook, exported type, or
  Reader/Command hook; no new pattern. Renames, typo fixes, single-
  conditional fixes, config value tweaks.
- **Mechanical sweep** — the same known-correct edit repeated across many
  files, introducing no new interface, pattern, or behavior. The test:
  *is correctness decided by mechanical ground truth?* If "lint is silent,
  types check, tests pass" fully establishes the change is right, the
  judgment gate has nothing to judge.
- **Non-trivial** — adds or changes a `useXxxReader` / `useXxxCommand`
  hook, an exported component, a `data/<resource>/` DTO, a `pages/`
  subfolder; introduces a pattern not already used in that layer; touches
  `data/api-client.ts` or the RTK store; changes behavior, error
  handling, or a public contract; any new feature work regardless of
  size.

If the change is trivial or a mechanical sweep, **say so, report the
Mechanical Gate result, and stop.** Being invoked is not itself a reason
to dispatch. Offer a forced pass; do not manufacture one. If a sweep turns
up a genuine defect along the way, split that specific fix out and treat
it as non-trivial on its own.

### 4. Dispatch the judgment gate

If the change is non-trivial, dispatch the architect subagent (`.claude/
agents/architect.md` or the inline `architect` review role if no agent is
defined) with the prompt structure in §"Dispatch prompt" below.

If `qa-engineer` is defined (it is not, today) and the change has thin test
coverage, dispatch both in a single message. The reference App Designer
project does this; PrepAI does not have a `qa-engineer` yet, so this
branch is a no-op for now.

### 5. Merge the report

The judgment gate returns its own findings. Merge them into one ranked list
in the format below. Do not relay two separate reports.

## Dispatch prompt

A subagent starts with no share of this context. Anything not restated in
the prompt is either re-derived at cost or missed outright. Every dispatch
prompt states:

1. **The concrete work list** — paste the actual `git diff --name-only`
   and `git diff --stat` output from step 1, filtered to `ui/**`. Not
   "the files changed on this branch", the real list.
2. **What has already been decided, and why** — the branch's intent from
   `git log --oneline dev..HEAD`, plus any constraint the user stated in
   this session.
3. **The scope boundary** — the architect owns:
   - Layer boundary violations (per `docs/architecture/architecture.md` §Frontend Refactor, the 7-layer model)
   - Naming convention violations (per `react-developer/SKILL.md` Rule #10)
   - Component / page structure (per `react-developer/SKILL.md` Rule #6)
   - The hard and soft violations in the "What the architect-review skill
     checks" subsection of `docs/architecture/architecture.md` §Frontend Refactor
   - The anti-patterns in the "Anti-patterns rejected" subsection of
     `docs/architecture/architecture.md` §Frontend Refactor
   - Code organization (file size, "one thing per file", barrel presence)
4. **Prerequisites** — the Mechanical Gate has already run. Paste its
   real output. The judgment gate must treat the gate as already-run, not
   re-run the suite.
5. **The verification to run, and the expected result** — which specific
   command to re-run to ground a particular claim, and what it should
   show. The gate may re-run individual commands to check a detail; that
   is grounding its analysis, not re-owning the gate.
6. **The review-only constraint.** State it explicitly:

   > This is a review-only pass. Do not edit any file. Report findings only.

   This one is load-bearing and must never be omitted.

## What to flag

The judgment gate must consult the "What the architect-review skill checks"
subsection of `docs/architecture/architecture.md` §Frontend Refactor for the full list. The
condensed reference (also reproduced here so the gate can run without
re-reading the architecture doc):

### Hard violations (Should-fix)

- **`components/` imports from `data/` or `logic/`** — the layer rule broken
- **`useQuery` / `useMutation` called outside `logic/`** — page or component doing what hooks should do
- **`useApiClient` / `getApiClient` called outside `data/` or `logic/`** — direct transport access
- **A page contains business logic** (calculations, branching, transforms) beyond composition — extract to a `logic/` hook
- **A component calls a hook from `logic/`** — components must be presentational; raise data via props
- **A `data/<resource>/` file imports from `logic/`** — circular layer
- **A `utils/` file imports from any layer** — `utils/` is a leaf
- **A `core/` file imports from any layer** — `core/` is the bottom
- **Component file not in `PascalCase.tsx`** — violates `react-developer/SKILL.md` Rule #10 (post-refactor)
- **Hook file not in `camelCase.ts`** — violates `react-developer/SKILL.md` Rule #10

### Soft violations (Nit)

- A resource folder has more than 5 hook files — consider grouping
- A `components/<feature>/` folder has no `index.ts` — add the barrel
- A page exceeds ~150 lines — split into sub-components
- A `logic/` hook doesn't have a query-key factory entry in `data/<resource>/<resource>.keys.ts` — extract
- A `data/<resource>/` folder is missing `<resource>.types.ts` or `<resource>.keys.ts` and the resource is non-trivial — add them
- A file's exports don't match its name (e.g. `useUserReader.ts` exporting `getUserData`) — rename or split

### File-shape (Should-fix, in their own section)

- **Passengers** — a file exports something not predicted by its name (e.g. `userCard.tsx` exporting both `UserCard` and `formatUserName`).
- **Imports after the first statement** — no ESLint rule covers this in `ui/`; the judgment gate is the only check.
- **Deep import past a directory's `index.ts` barrel** — e.g. `import { getMe } from '@/data/user/user.api'` instead of `import { getMe } from '@/data/user'`. Flag only the ones *this change adds*, never the backlog.
- **Stringly-typed domain value** — a parameter or field typed `string` whose real domain is a closed set (a status, a mode, a type tag). Wants a union.
- **Trailing `export { ... }` block in a non-barrel file** — e.g. `const Foo = ...; const Bar = ...; export { Foo, Bar };` instead of `export const Foo = ...; export const Bar = ...;`. Exception: barrel/`index.ts`.
- **Oversized file** — a file this change substantially modified (50+ added lines, or a quarter of its lines touched) that is over 250 lines when the change is done. *Blocker* if the file ended the change larger than it started and was already over 250; *Should-fix* otherwise. Brand-new files are exempt from the ceiling — judge them on the other shape items instead.

### What NOT to flag (other skills' territory)

- Naming conventions, formatting, JSDoc — `developer` skill
- Presentational rules (arrow functions, no `any`, CSS conventions) — `react-developer` skill
- Backend layer rules — `nestjs-developer` skill
- API contract design — `api-design` skill
- Database rules — `prisma-database` skill
- AI agent rules — `mastra-ai` skill
- Test coverage gaps — `testing` skill (when a `qa-engineer` agent exists)

If a finding belongs in another skill's lane, **say which skill owns it**
in the report and route it there. Do not duplicate the other skill's
review.

## Report format

Open with a header:

- **Scope reviewed** — the resolved range or paths, which fallback was
  used, and the `ui/**` filter applied
- **Mechanical Gate** — real pass/fail summary per command, which Tier 2
  suites ran or were skipped
- **Classification** — trivial / mechanical sweep / non-trivial, with the
  reasoning
- **Gates dispatched** — which (architect, or both if `qa-engineer`
  exists), and why that selection

Then the findings, **ranked most-severe first**, each as:

- **Severity** — Blocker / Should-fix / Nit
- **`file:line`** — the anchor, as a clickable path
- **Finding** — one sentence stating the defect
- **Why it matters** — the specific rule, layer boundary, or anti-pattern
  in `docs/architecture/architecture.md` §Frontend Refactor or `react-developer/SKILL.md`.
  Not "this is bad practice."
- **Owner** — the agent or skill that should fix it:
  - `frontend-developer` (the engineer who wrote the code)
  - `architect` (only for rule- or ADR-shaped findings, e.g. a new layer
    boundary violation that needs an ADR)
  - `qa-engineer` (test-only gaps, when the agent exists)

**"No findings" is a valid result.** Report it plainly. Do not pad a clean
review with nits to make the pass look productive — that trains the reader
to skim the list, which is exactly how a real Blocker gets missed.

### File-shape findings — its own section, after the main findings

File-shape findings (oversized files, passengers, scattered types, deep
imports past a barrel, stringly-typed values, imports not at the top,
trailing export blocks in non-barrel files) get their **own section**,
separate from the main ranked list, with its own severities. A single
merged ranked list is *what buried these before*: file-shape findings lose
every ranking contest against correctness findings, because a correctness
Blocker will always out-rank a "this file is doing three things" Should-fix
in a shared list, even when the file-shape finding is the one the repo
owner actually cares about.

**Severity floor and ceiling for this section only:**

- **Floor: no Nit.** This preserves the report's existing anti-padding rule —
  if a finding isn't worth Should-fix, don't report it at all, in this
  section or any other.
- **Ceiling: only two things may be a Blocker here** — a file already over
  250 lines that ended the change *larger* than it started, or a file
  this change substantially modified (50+ added lines, or a quarter of
  its lines touched) that is still over 250 lines when the change is
  done. Everything else in this section is Should-fix.

**Inherited size is still a defect.** The question is not "did this change
make the file big" but "is this file acceptable now." A brand-new file has
no inherited debt by definition — every line is new, so "substantially
modified" is trivially true. Judge a new file on shape instead (see the
file-shape checklist below), not on this ceiling.

**File-shape checklist (answers from the file's first 40 lines and its
export list — keeps this a bounded check, not an open-ended quality
judgment):**

1. **Passengers.** A second exported component, or a cluster of exported
   utilities, living in a file named after something else. If the file's
   name does not predict its exports, it is two files. A generic name
   (`.parts.`, `utils`, `helpers`, `misc`) doesn't pass this test by
   default — judge whether the exports actually belong together, not
   whether the name predicts them.
2. **Imports not at the top.** No lint rule covers this. A mechanical rule
   is planned but not yet in place, so this one is entirely the judgment
   gate's.
3. **Deep imports past a directory's `index.ts` barrel.** A consumer
   reaching into a sibling file (e.g. `from '@/data/user/user.api'`) instead
   of the directory's public surface (`from '@/data/user'`). Flag only the
   ones *this change adds*, never the backlog.
4. **Stringly-typed domain values.** A parameter or field typed `string`
   whose real domain is a closed set (an attribute name, a mode, a status).
   It wants a union. Flag only where the set is genuinely closed and
   enumerable from the call sites in the diff.
5. **Trailing export block in a non-barrel file.** A standalone
   `export { a, b, c };` at the end of the file re-exporting declarations
   defined above instead of `export` on each one inline. Exception: a
   barrel/`index.ts`, where a trailing export list is the idiom. A bare
   `export {};` is the required TypeScript module marker — never flag it.
6. **File name doesn't predict exports.** A file named `useUserReader.ts`
   exporting `getUserData`, or `helpers.ts` containing 12 unrelated
   functions. The file should be split.

**Show your exemptions.** When the gate clears a file-shape finding by
leaning on an ADR exemption, a dispatcher classification (e.g. "this is
a mechanical sweep"), or a pre-existing-debt argument, it must **name
the exemption in the report rather than silently omit the finding.** One
line is enough — "not flagged: `<path>` is over 250 lines but
ADR-0008 §1.4-2 exempts the micro-feature exception" — and it converts
what would otherwise be an invisible miss into something visible and
arguable, which is exactly where a taste disagreement belongs.

**No commendations.** This report format has no positive-findings slot.
Calling a suppression, a workaround, or any other finding "worth keeping
as a pattern" is not a finding and does not belong in this section, or
anywhere else in the report — say what's wrong, not what's merely not
wrong.

**Formatting is not the gate's job.** Prettier is a mechanical check
already run by the Mechanical Gate. Neither judgment gate should spend a
finding on formatting — if the Mechanical Gate is green, the file is
formatted, and there is nothing left to say.

## Rules (non-negotiable)

- **Read-only, always.** This skill never edits a repo file. Findings
  route to a named owner; the user decides what to fix and when.
- **Never run the fix-and-re-review loop from here.** That loop is the
  user's call.
- **Evidence, not assertions.** Paste real Mechanical Gate output. Never
  report a gate as green without the command output behind it — the
  principle is `verification-before-completion`.
- **Dispatch prompts are self-contained.** Restate everything; assume the
  subagent knows nothing about this conversation.
- **Don't dispatch on a trivial change.** Report the classification and
  the Mechanical Gate result instead.
- **State the fallback you took.** A user who asked for a branch review
  and got an uncommitted-changes review must be told.
- **Filter to `ui/**` only.** This skill does not review backend changes.
- **Show your exemptions.** When the gate clears a finding by leaning on
  an ADR exemption, a dispatcher classification, or a pre-existing-debt
  argument, name the exemption in the report. Silently omitting an
  exemption converts a debatable finding into an invisible miss.
- **Both gates in one message when both apply.** Serializing them doubles
  latency for no added information. (Currently a no-op for PrepAI since
  `qa-engineer` is not defined; the rule activates the day a
  `qa-engineer` agent lands.)

## References

- [`docs/architecture/architecture.md`](../../../docs/architecture/architecture.md) — Master
  full-stack architecture blueprint
- [`docs/architecture/frontend-refactor.md`](../../../docs/architecture/frontend-refactor.md) — the
  frontend refactor plan this skill enforces (the 7-layer model, hard /
  soft violations, anti-patterns)
- [`react-developer/SKILL.md`](../react-developer/SKILL.md)
  — presentational rules + Rule #10 (file naming)
- [`verify-implementation/SKILL.md`](../verify-implementation/SKILL.md)
  — the Mechanical Gate this skill invokes
- Reference App Designer project pattern this skill is modeled on
