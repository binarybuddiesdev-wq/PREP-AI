---
name: pr-review
description: Runs the stack architect-review skill (server-architect-review and/or ui-architect-review) on a GitHub pull request and posts each finding as an inline review comment via gh. Use when asked to review a PR number, a PR link, or "review this branch's PR."
---

# PR Review

Reviews a GitHub pull request with the stack architect-review skills (`server-architect-review` for `server/**`, `ui-architect-review` for `ui/**`; both when the PR touches both), then posts
every finding as an inline review comment on the PR via the `gh` CLI. This
is PrepAI's equivalent of a GitLab-style MR review — adapted for GitHub,
since this repo has no GitLab remote.

Argument: the PR number or URL. Both work:

- `/pr-review 42`
- `/pr-review https://github.com/<owner>/<repo>/pull/42`

No argument means ask for one — don't guess from the current branch, since
the current branch and "the PR to review" are not always the same thing.

## Comment body contract

Every posted comment is **the defect in one to three plain sentences** —
nothing else.

- **No** severity marker (`Blocker`, `Should-fix`, `Nit`), **no** owner name (`architect`, `backend-developer`, `frontend-developer`, `backend-qa-engineer`, `frontend-qa-engineer`), **no** "finding N of M", **no** headers.
- State the concrete consequence when it isn't obvious from the defect itself ("...so a second request in the same second double-charges the user").
- A short bullet list is fine when one finding covers several lines in the same file; otherwise one comment per finding.

**Why this strict a contract:** severity/owner vocabulary belongs to whoever
commissioned the review (visible in the local report), not to the PR author
reading GitHub's UI. Posting internal triage language to a public/shared PR
comment reads as presumptuous and leaks process detail nobody asked to see.

## Steps

### 1. Resolve the PR

```bash
gh pr view <pr> --json number,title,state,baseRefName,headRefName,headRefOid,url
```

- Note `baseRefName` (PrepAI's base is almost always `main` — there is no
  `dev` branch; confirm with `git branch -a` if in doubt) and `headRefOid`
  (the exact commit this review targets — step 5 needs it to detect a
  force-push between review and posting).
- If `state` is `MERGED` or `CLOSED`, tell the user and ask before
  reviewing further.

### 2. Fetch and check out the PR head, isolated from the user's work

```bash
git fetch origin pull/<pr>/head:pr-<pr>-review
git worktree add --detach /tmp/pr-<pr>-review pr-<pr>-review
cd /tmp/pr-<pr>-review && pnpm install
```

(On Windows, use a short path like `C:/wt-pr<pr>` instead of `/tmp/...` —
long paths under a deep repo clone can hit `MAX_PATH`.)

A worktree, not a checkout in the user's working directory, so their
uncommitted work is never disturbed and the review runs against the PR's
actual code, not whatever the user happens to have checked out.

### 3. Run the stack architect-review skills in the worktree

Decide the stack(s) from `gh pr diff <pr> --name-only` (`server/**`, `ui/**`, or both), then invoke `server-architect-review` and/or `ui-architect-review` from the worktree, with the scope
override `origin/<baseRefName>...HEAD`. This is a whole-branch, pre-merge
scope — the trivial/mechanical-sweep exits in that skill still apply
normally; this isn't a special pre-merge-only mode, just a specific scope.

Every subagent those skills dispatch (their `backend-architect` / `frontend-architect`,
`backend-qa-engineer` / `frontend-qa-engineer`, and default-correctness-pass subagents) must be told the
worktree's absolute path as the repo root and prefix every command with
`cd <worktree-path> &&` — a subagent otherwise starts in the orchestrator's
own working directory, not the worktree, and would review the wrong tree.

Those skills are read-only and stay that way here too. Don't fix
anything in the worktree — this skill posts findings, it doesn't resolve
them.

### 4. Normalize findings into `findings.json`

One entry per finding from the merged report (including the mandatory-walk
`❌` rows and the file-shape section), written to the scratchpad:

```json
[
  {
    "path": "server/src/modules/topic/topic.service.ts",
    "line": 42,
    "body": "Defect in one to three plain sentences."
  },
  {
    "path": "docs/architecture/architecture.md",
    "body": "A finding about a whole file, no specific line."
  },
  { "body": "A finding about the whole PR, e.g. no test file was added for new branching logic." }
]
```

- `path` is repo-relative with forward slashes; `line` is a line number on the PR's **head** (new) side.
- Anchor each finding at its most specific site. A finding spanning multiple files is posted once, at the primary site, naming the others in the body.
- A `✅`/`➖` mandatory-walk row is not a finding — only `❌` rows and judgment-gate findings get posted.
- No findings → empty array. Tell the user, post nothing, skip to step 7.

### 5. Preview before posting (dry run)

```bash
gh pr diff <pr> --name-only   # confirm which files are actually in the diff, for sanity-checking findings.json paths
gh api repos/{owner}/{repo}/pulls/<pr> --jq '.head.sha'   # re-check head SHA against step 1's headRefOid
```

If the head SHA has changed since step 1 (the author pushed more commits),
**stop and go back to step 1** — don't post comments anchored to lines that
have since moved.

Show the user every comment body with its target `path:line` and ask
through `AskUserQuestion` whether to post. **Nothing is posted without an
explicit yes** — this publishes to a shared PR that others may be watching.

### 6. Post

For each finding, post an inline review comment:

```bash
gh api repos/{owner}/{repo}/pulls/<pr>/comments \
  -f body="<comment body>" \
  -f commit_id="<headRefOid>" \
  -f path="<path>" \
  -F line=<line>
```

For a finding with no `line` (a whole-file or whole-PR finding), post a
general PR comment instead:

```bash
gh pr comment <pr> --body "\`<path>\`: <comment body>"
```

If the GitHub API rejects an inline anchor (the line isn't part of the
diff hunk — a 422), fall back to the general-comment form and say so to
the user. If a run fails partway, re-running is safe to retry only for the
comments that didn't yet post — check `gh pr view <pr> --json comments`
first to avoid posting true duplicates.

Reply to the user with:

- the comment URLs GitHub returns
- counts of inline vs. general comments posted
- the **full local architect-review report(s)**, severity and owner
  included — that triage detail lives here, never in the PR itself

### 7. Clean up

```bash
git worktree remove /tmp/pr-<pr>-review    # or the C:/wt-pr<pr> path on Windows
git branch -D pr-<pr>-review
```

Remove the worktree and the temporary branch on **every** exit path:
clean review with nothing to post, user declines to post, or any step
fails partway.

## Rules

- **Never post without the user's explicit yes** at step 5.
- **The comment body contract is absolute** — no severity, no owner, no internal vocabulary in anything posted to GitHub.
- **Never resolve, edit, or delete an existing review thread** — only new comments are added.
- **Read-only on the PR's code.** This skill never pushes to the PR branch.
- **Confirm the head SHA hasn't moved** between step 1 and step 6 before posting.
- Requires `gh auth status` to already be authenticated; if not, tell the user — don't attempt to work around it.
