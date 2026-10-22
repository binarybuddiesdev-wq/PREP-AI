# Report format and file-shape findings

Reference for the `server-architect-review` skill. The shape of the merged report and of the file-shape section. Load before writing the report.

## Report format

Open with a header:

- **Scope reviewed** — the resolved range or paths, and which fallback was used.
- **Mechanical Gate** — real pass/fail summary per command, which Tier 2 checks ran or were skipped, and why.
- **Classification** — trivial / mechanical sweep / non-trivial, with the reasoning.
- **Gates dispatched** — which (`backend-architect`, `backend-qa-engineer`, and the always-on default correctness pass), and why that selection.

Then **the mandatory-walk block in full** (step 3's `Check | Result | Note` table), before any finding.

Then the findings, **ranked most-severe first**, each as:

- **Severity** — Blocker / Should-fix / Nit.
- **`file:line`** — the anchor, as a clickable path.
- **Finding** — one sentence stating the defect.
- **Why it matters** — the specific rule and where it is written (`prisma-database` rule 2, `nestjs-developer` rule 4, `api-design` § contract). Not "this is bad practice".
- **Owner** — who should fix it: `backend-developer` (the engineer who wrote the code); `architect` (only for rule- or ADR-shaped findings that need an ADR or a tooling rule); `backend-qa-engineer` (test-only gaps).

**"No findings" is a valid result.** Report it plainly. Do not pad a clean review with nits: that trains the reader to skim, which is how a real Blocker gets missed.

A finding that is only about code the diff did not add (the backlog each skill lists) is not reported. If you clear a finding by leaning on an exemption, a classification or a pre-existing-debt argument, **name the exemption in one line** ("not flagged: `theory.service.ts` 403 on another user's session is listed backlog in `api-design`") so a disagreement is visible instead of an invisible miss.

## File-shape findings — their own section, after the main findings

A single ranked list buries file-shape findings: a correctness Blocker always outranks "this file does three things". They get their own section.

**Severity floor and ceiling for this section:**

- **Floor: no Nit.** If it is not worth a Should-fix, do not report it.
- **Ceiling: only two things may be a Blocker** — a file already over 250 lines that ended the change larger than it started, or a file this change substantially modified (50+ added lines, or a quarter of its lines touched) that is still over 250 lines. Everything else is Should-fix. A brand-new file has no inherited debt: judge it on shape, not on this ceiling.

**File-shape checklist** (answered from the file's first 40 lines and its export list, so it stays a bounded check):

1. **Passengers.** A second exported class, or a cluster of exported helpers, in a file named after something else. If the name does not predict the exports, it is two files.
2. **Imports not at the top.** No lint rule covers this.
3. **Deep import into another module's internals** instead of its Nest module or `dto` barrel. Flag only what this change adds.
4. **Stringly-typed domain values.** A field or parameter typed `string` whose real domain is a closed set (a category, a difficulty, a status). It wants a union or a Prisma enum.
5. **Trailing `export { … }` block in a non-barrel file.** Barrels (`index.ts`) are the exception. A bare `export {};` is the required module marker; never flag it.
6. **File name does not predict exports.** `topic.service.ts` exporting a DTO, or `helpers.ts` holding unrelated functions.

**No commendations.** This format has no positive-findings slot. **Formatting is not the gate's job:** if the Mechanical Gate is green, the file is formatted.
