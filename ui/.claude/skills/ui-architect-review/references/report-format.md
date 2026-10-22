# Report format and file-shape findings

Reference for the `ui-architect-review` skill. The shape of the merged report and of the file-shape section. Load before writing the report.

## Report format

Open with a header:

- **Scope reviewed** — the resolved range or paths, and which fallback was used.
- **Mechanical Gate** — real pass/fail summary per command, which Tier 2 checks ran or were skipped (including whether the changed screen was actually run), and why.
- **Classification** — trivial / mechanical sweep / non-trivial, with the reasoning.
- **Gates dispatched** — which (`frontend-architect`, `frontend-qa-engineer`, and the always-on default correctness pass), and why that selection.

Then **the mandatory-walk block in full** (step 3's `Check | Result | Note` table), before any finding.

Then the findings, **ranked most-severe first**, each as:

- **Severity** — Blocker / Should-fix / Nit.
- **`file:line`** — the anchor, as a clickable path.
- **Finding** — one sentence stating the defect.
- **Why it matters** — the specific rule and where it is written (`react-developer` rule 7, `frontend-data-fetching` § …, ADR-0008). Not "this is bad practice".
- **Owner** — who should fix it: `frontend-developer` (the engineer who wrote the code); `architect` (only for rule- or ADR-shaped findings that need an ADR or a tooling rule); `frontend-qa-engineer` (test-only gaps).

**"No findings" is a valid result.** Report it plainly. Do not pad a clean review with nits: that trains the reader to skim, which is how a real Blocker gets missed.

A finding that is only about code the diff did not add (the backlog `react-developer` lists: default-exported pages, `fetch` in `SettingsPage`) is not reported. If you clear a finding by leaning on an exemption, a classification or a pre-existing-debt argument, **name the exemption in one line** ("not flagged: `DashboardPage.tsx` is a default export, listed backlog in `react-developer`") so a disagreement is visible instead of an invisible miss.

## File-shape findings — their own section, after the main findings

A single ranked list buries file-shape findings: a correctness Blocker always outranks "this file does three things". They get their own section.

**Severity floor and ceiling for this section:**

- **Floor: no Nit.** If it is not worth a Should-fix, do not report it.
- **Ceiling: only two things may be a Blocker** — a file already over 250 lines that ended the change larger than it started, or a file this change substantially modified (50+ added lines, or a quarter of its lines touched) that is still over 250 lines. Everything else is Should-fix. A brand-new file has no inherited debt: judge it on shape, not on this ceiling.

**File-shape checklist** (answered from the file's first 40 lines and its export list, so it stays a bounded check):

1. **Passengers.** A second exported component, or a cluster of exported helpers, in a file named after something else. If the name does not predict the exports, it is two files.
2. **Imports not at the top.** No lint rule covers this.
3. **Deep import past a folder's `index.ts` barrel** (`@/components/hello/Hello` instead of `@/components/hello`). Flag only what this change adds.
4. **Stringly-typed domain values.** A prop or field typed `string` whose real domain is a closed set. It wants a union.
5. **Trailing `export { … }` block in a non-barrel file.** Barrels are the exception. A bare `export {};` is the required module marker; never flag it.
6. **File name does not predict exports.** `useUser.ts` exporting `formatUserName`, or `helpers.ts` holding unrelated functions.

**No commendations.** This format has no positive-findings slot. **Formatting is not the gate's job:** if the Mechanical Gate is green, the file is formatted.
