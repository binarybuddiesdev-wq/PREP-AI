# PrepAI Architecture — Building, Editing, Extending

> **Audience:** future AI agents (Claude, GPT, Gemini, etc.) and human
> contributors who need to understand how the architecture documentation
> is structured, how to edit it, and what commands to run. This file is
> the "operator's manual" for the architecture docs.

## 0. What this folder is

```
docs/architecture/
├── README.md          ← human-friendly index of everything
├── services.md        ← service catalog (owners, SLOs, dependencies)
├── nfrs.md            ← non-functional requirements + SLO targets
├── diagrams/          ← Mermaid source files (the canonical diagrams)
│   ├── c4-01-context.mmd
│   ├── c4-02-container.mmd
│   ├── c4-03-component.mmd
│   ├── seq-01-auth-webhook.mmd
│   ├── seq-02-theory-ai-scoring.mmd
│   └── seq-03-piston-sandbox.mmd
└── BUILDING.md        ← this file

docs/architecture/viewer.html       ← standalone HTML viewer (generated; see §3)

docs/adr/                       ← Architecture Decision Records
├── README.md                   ← template + style guide
├── 0000-index.md               ← ADR index
├── 0001-polyglot-persistence.md
├── 0002-clerk-webhook-vs-lazy-create.md
├── 0003-pgvector-for-rag.md
├── 0004-bullmq-for-async-jobs.md
├── 0005-redis-quota-counters.md
└── 0006-defer-firecracker-isolation.md
```

## 1. Source of truth — read this first

**Diagrams** live as `.mmd` (Mermaid) files in `docs/architecture/diagrams/`.
They render natively on GitHub, GitLab, Bitbucket, Obsidian, and VS Code
(with the Mermaid plugin). No tool, no script, no build — open and read.

**ADRs** live as Markdown files in `docs/adr/`. They are pure prose; no
build step. Number them sequentially (`0007-...`, `0008-...`); never
re-number or delete — superseded ADRs are marked
`Status: Superseded by ADR-XXXX` and kept for history.

**Service catalog** (`services.md`) and **NFRs** (`nfrs.md`) are
hand-written Markdown. Update them in the same PR that changes the
underlying service or its targets.

The HTML viewer is a **derived artifact** — generated from the
`.mmd` files. It exists for offline use and for users who want
a single-file, no-network, no-server viewing experience. **Do not
edit the Mermaid content inside the HTML by hand**; the build script
will overwrite it.

## 2. Why this structure (the design)

We follow the pattern used at Google, Microsoft, Stripe, Spotify:

1. **Diagrams as code.** Mermaid in `.mmd` files under version
   control. Diff-able, code-reviewable, can be linted in CI.
2. **ADRs for every decision.** Michael Nygard format: Status,
   Context, Decision, Consequences, Alternatives. The "why" is
   as important as the "what."
3. **Service catalog with named owners.** Every service has an
   owner, SLO, and runbook link. No "orphan" services.
4. **NFRs in writing.** Latency, availability, throughput, retention,
   cost — all quantified. Every architecture decision cites a number.
5. **Generated viewer, not hand-edited HTML.** The HTML is a build
   artifact. The `.mmd` files are the source. This is the
   same pattern as Docusaurus, Gatsby, etc.

## 3. The build script

`scripts/build-architecture-viewer.ts` inlines each `.mmd` file into
the matching `<pre class="mermaid">` block in `docs/architecture/viewer.html`.
The script:

- Reads each `.mmd` file from `docs/architecture/diagrams/`
- Finds the corresponding `<pre class="mermaid" data-src="...">` in
  the HTML (matched by the `data-src` attribute)
- Replaces the inline content with the file contents
- Writes the HTML back (unless `--check` is passed)
- Fails loudly if a file is missing or a marker is missing

### Commands

From the **repo root**:

```bash
# Update the HTML to match the .mmd files
pnpm build:viewer

# CI mode: fail (exit 1) if the HTML is out of date, but don't write
pnpm build:viewer:check

# Direct invocation (equivalent to pnpm build:viewer)
pnpm --filter server exec tsx ../scripts/build-architecture-viewer.ts
```

The script is **idempotent**: re-running with no changes is a no-op.
If a `.mmd` file was edited, the script re-inlines it. If everything
matches, it prints "already up to date (no changes)."

## 4. When to run the build

Run `pnpm build:viewer` whenever you edit any file in
`docs/architecture/diagrams/`. The script doesn't auto-run; we
don't have a watch mode because the `.mmd` files change rarely
(once every few weeks), and CI catches drift via `build:viewer:check`.

### Recommended CI setup

Add to your CI pipeline (`.github/workflows/ci.yml` or equivalent):

```yaml
- name: Verify architecture viewer is up to date
  run: pnpm build:viewer:check
```

This fails the PR if a contributor edited a `.mmd` file but forgot
to re-run the build script. Cheap, fast, no false positives.

## 5. Editing a diagram

1. Edit the `.mmd` file in `docs/architecture/diagrams/`.
2. Run `pnpm build:viewer`.
3. Open `docs/architecture/viewer.html` in a browser to verify the
   change renders correctly. Mermaid is a forgiving format but does
   have syntax errors (unclosed `subgraph`, mismatched brackets, etc.)
   that show as red text in the diagram.
4. Commit both the `.mmd` change and the regenerated HTML in the
   same PR.

## 6. Adding a new diagram

1. Create `docs/architecture/diagrams/<your-id>.mmd` with the
   Mermaid source. Start with a working Mermaid Live Editor draft
   if you're new to Mermaid: https://mermaid.live/
2. Add a `<div id="view-<tab-id>" class="diagram-view">` block in
   `docs/architecture/viewer.html` with a matching `<pre class="mermaid" data-src="diagrams/<your-id>.mmd">`.
3. Add a tab button in the tab bar at the top of the HTML.
4. Add an entry to the `meta` object in the HTML's `<script>` block
   (title + description).
5. Add the diagram to the `DIAGRAMS` array at the top of
   `scripts/build-architecture-viewer.ts`.
6. Add it to the index in `docs/architecture/README.md`.
7. Run `pnpm build:viewer` and verify the HTML renders.

## 7. Adding a new ADR

1. Copy `docs/adr/README.md` template to `docs/adr/NNNN-short-title.md`
   (next sequential number — check the highest existing number first).
2. Fill in Status, Context, Decision, Consequences, Alternatives,
   References.
3. Update `docs/adr/0000-index.md` to add the new entry.
4. Update `docs/architecture/README.md` "Decisions" section to
   reference the new ADR if it's user-facing.
5. If the ADR changes a service's SLO or dependency, update
   `docs/architecture/services.md` and `docs/architecture/nfrs.md`
   in the same PR.
6. If the ADR supersedes an earlier one, mark the old one
   `Status: Superseded by ADR-NNNN`. Do not delete or re-number.

## 8. How the HTML viewer works (for the curious)

`docs/architecture/viewer.html` is a single self-contained file.
It loads:
- `tailwindcss` (CDN) for styling
- `mermaid@10` (CDN) for diagram rendering
- `svg-pan-zoom` (CDN) for pan/zoom controls

The 6 diagrams are inlined as `<pre class="mermaid">` blocks.
On page load, Mermaid's `startOnLoad: true` discovers them and
replaces each `<pre>` with an `<svg>`. A 600ms `setTimeout` then
initializes `svg-pan-zoom` on each SVG. Tabs use CSS `visibility`
+ `opacity` to show/hide (no layout thrash).

Because the diagrams are **inlined**, the file works on `file://`
(opening the HTML directly from disk) without any server. If you
serve it over HTTP, the same file works with no special setup.

## 9. Verifying the viewer

After editing, the recommended verification:

```bash
# 1. Rebuild
pnpm build:viewer

# 2. Open the file (any of these works)
#    a. file:// path (works because diagrams are inlined)
start C:\teja\coding\PREP-AI\docs\architecture\viewer.html
#    b. Local server (if you want to test fetch-from-mmd behavior)
cd C:\teja\coding\PREP-AI\docs
python -m http.server 8765
#       then open http://127.0.0.1:8765/architecture-viewer.html
```

In the browser, click every tab and verify:
- The diagram renders (not an error message)
- The diagram is centered in the viewport (not stuck in a corner)
- `+ Zoom In` and `− Zoom Out` actually zoom (not inert)
- `↺ Fit & Center` resets to a centered fit-to-viewport state

If a diagram shows a syntax error, Mermaid prints it in red inside
the diagram. Fix the `.mmd` file and re-run the build.

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm build:viewer` fails with "missing diagram file" | One of the 6 expected `.mmd` files is missing or renamed | Re-create the file or remove it from the `DIAGRAMS` array in the script |
| `pnpm build:viewer` fails with "could not find <pre data-src=...>" | The HTML is missing the matching `<pre>` block for one of the diagrams | Add the `<pre>` block to the HTML (see §6) |
| Diagram shows red text in the browser | Mermaid syntax error in the `.mmd` file | Open the `.mmd` in https://mermaid.live/ to debug |
| Diagram is tiny in the corner | svg-pan-zoom init race — increase the 600ms delay in the HTML's `window.addEventListener('load', ...)` callback | Edit the delay, refresh the browser |
| `pnpm build:viewer:check` fails in CI but local build works | The HTML was regenerated but not committed | `git add docs/architecture/viewer.html && git commit` |

## 11. What an AI should do when asked to change the architecture

When a user asks "add a new service" / "change the database" /
"add a queue" or any other architectural change, follow this
checklist (the same one a senior engineer would):

1. **Read first.** Read `docs/architecture/README.md`,
   `docs/architecture/services.md`, and the relevant ADR(s)
   (e.g., for "use a queue" → `docs/adr/0004-bullmq-for-async-jobs.md`).
2. **Check the NFRs.** `docs/architecture/nfrs.md` has the SLO
   targets. Will your change improve or regress them?
3. **Add a new ADR** if the change is non-trivial. Follow
   `docs/adr/README.md` template. Number sequentially.
4. **Update `services.md`** with the new service's owner, SLO,
   dependencies, runbook link.
5. **Update `nfrs.md`** if you added a new SLO target.
6. **Edit or add diagrams.** If the change touches the
   architecture, edit the existing `.mmd` file or add a new one
   (see §5 / §6).
7. **Run `pnpm build:viewer`** to regenerate the HTML.
8. **Update `docs/architecture/README.md`** index if you added
   a new diagram or service.
9. **Commit everything in one PR** with a clear message:
   ```
   feat(arch): add Redis cache layer for question bank

   - docs/adr/0007-redis-cache-question-bank.md (new)
   - docs/architecture/diagrams/... (updated)
   - docs/architecture/services.md (added cache service)
   - docs/architecture/viewer.html (regenerated)
   ```

## 12. What "good" looks like

The folder is healthy if:

- Every diagram has a matching `.mmd` source file
- Every ADR has a Status, Context, Decision, Consequences, Alternatives
- Every service in `services.md` has a named owner (even if it's "uday")
- Every latency / availability / cost claim links to a number in `nfrs.md`
- `pnpm build:viewer:check` passes in CI
- New contributors can answer "where does the diagrams-as-code live?" by
  reading `README.md` and "how do I add a diagram?" by reading this file

If any of those aren't true, fix the docs in the same PR that exposed
the gap.
