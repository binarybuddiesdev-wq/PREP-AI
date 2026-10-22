# What every dispatch prompt must carry

Reference for the `ui-architect-review` skill. Load before dispatching any subagent.

A subagent starts with no share of this context. Anything not restated in the prompt is either re-derived at cost or missed outright. Every dispatch prompt states:

1. **The concrete work list** — paste the actual `git diff --name-only` and `git diff --stat` output from step 1, filtered to `ui/**`. Not "the files changed on this branch", the real list.
2. **What has already been decided, and why** — the branch's intent from `git log --oneline main..HEAD`, plus any constraint the user stated in this session.
3. **`<base>` and the explicit SHAs** — `main`, the merge-base SHA and the head SHA, so no agent resolves its own range.
4. **The scope boundary.** `frontend-architect` owns:
   - layer boundary violations, applied only to layers whose folders exist in `ui/src` (see `checklist.md` § Current state);
   - naming and file structure (per `react-developer` rules 6 and 10);
   - component, hook and page structure and size (`react-developer`);
   - data-fetching design: `useApiClient`, query keys, error and loading handling (`frontend-data-fetching`);
   - the security authoring checks in `ui-developer` § Security authoring notes;
   - failure handling design (`ui-developer` § Failure handling);
   - file shape (see `report-format.md`).

   `frontend-qa-engineer` owns coverage gaps and regression reasoning. The default correctness pass owns general correctness and simplification. **Name every concurrent agent and say none reports in another's lane.**

5. **Prerequisites** — the Mechanical Gate has already run. Paste its real output. No agent re-runs the suite as its first step.
6. **The verification to run, and the expected result** — which specific command re-grounds a particular claim, and what it should show. Re-running a command to check a detail is grounding, not re-owning the gate.
7. **The skills to load.** Name them, and say to read a changed file under `ui/` first so the stack skills are listed.
8. **The review-only line, verbatim, never omitted:**

   > This is a review-only pass. Do not edit any file. Report findings only.

9. **The return shape.** Report findings only, one block per finding, nothing around them:

   `SEVERITY | file:line | one-sentence defect | why it matters | evidence (one line, optional)`

   No preamble, no methodology, no restatement of the diff, no summary, no files-reviewed list, no commendations. "No findings" is a complete answer. Think as thoroughly as the dimension needs; report only in this shape.
