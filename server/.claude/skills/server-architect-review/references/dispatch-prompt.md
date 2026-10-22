# What every dispatch prompt must carry

Reference for the `server-architect-review` skill. Load before dispatching any subagent.

A subagent starts with no share of this context. Anything not restated in the prompt is either re-derived at cost or missed outright. Every dispatch prompt states:

1. **The concrete work list** — paste the actual `git diff --name-only` and `git diff --stat` output from step 1, filtered to `server/**`. Not "the files changed on this branch", the real list.
2. **What has already been decided, and why** — the branch's intent from `git log --oneline main..HEAD`, plus any constraint the user stated in this session.
3. **`<base>` and the explicit SHAs** — `main`, the merge-base SHA and the head SHA, so no agent resolves its own range.
4. **The scope boundary.** `backend-architect` owns:
   - module structure and layer boundaries (per `nestjs-developer`: the `modules/<name>/` shape, `common/` never importing from `modules/`);
   - the non-negotiable rules in `nestjs-developer` and `api-design` (envelope, Fastify, `ConfigService`, exception types, `.js` extensions);
   - Prisma split and query-pattern violations (per `prisma-database`: wrong database for the model, missing `userId` scope, missing index on a new filtered or sorted column) and schema-change safety (`db-schema-change`);
   - Mastra conventions (per `mastra-ai`) when `server/src/mastra/**` is touched;
   - the security authoring checks in `server-developer` § Security authoring notes;
   - failure handling design (`server-developer` § Failure handling);
   - file shape (see `report-format.md`).

   `backend-qa-engineer` owns coverage gaps and regression reasoning. The default correctness pass owns general correctness and simplification. **Name every concurrent agent and say none reports in another's lane.**

5. **Prerequisites** — the Mechanical Gate has already run. Paste its real output. No agent re-runs the suite as its first step.
6. **The verification to run, and the expected result** — which specific command re-grounds a particular claim, and what it should show. Re-running a command to check a detail is grounding, not re-owning the gate.
7. **The skills to load.** Name them, and say to read a changed file under `server/` first so the stack skills are listed.
8. **The review-only line, verbatim, never omitted:**

   > This is a review-only pass. Do not edit any file. Report findings only.

9. **The return shape.** Report findings only, one block per finding, nothing around them:

   `SEVERITY | file:line | one-sentence defect | why it matters | evidence (one line, optional)`

   No preamble, no methodology, no restatement of the diff, no summary, no files-reviewed list, no commendations. "No findings" is a complete answer. Think as thoroughly as the dimension needs; report only in this shape.
