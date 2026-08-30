/**
 * scripts/build-architecture-viewer.ts
 *
 * Inlines the 6 Mermaid diagrams from docs/architecture/diagrams/*.mmd into
 * docs/architecture/viewer.html between stable HTML comment markers.
 *
 * Why: the HTML viewer is a self-contained file (no server needed), but we
 * want docs/architecture/diagrams/*.mmd to be the single source of truth
 * (renders natively on GitHub). This script bridges the two.
 *
 * Run with:  pnpm build:viewer           # update the HTML in place
 *            pnpm build:viewer:check     # CI mode: fail if out of date (no write)
 *   or:       pnpm --filter server exec tsx ../scripts/build-architecture-viewer.ts [--check]
 *
 * The script:
 *   1. Reads each .mmd file
 *   2. Locates the corresponding <pre class="mermaid"> block in the HTML
 *      (matched by the data-src attribute, which is `diagrams/<file>.mmd`
 *      relative to the HTML)
 *   3. Replaces the inline content with the file contents (unless --check)
 *   4. Writes the HTML back (skipped in --check mode)
 *
 * Idempotent: re-running with no changes is a no-op. Fails loudly if a
 * marker is missing or a file is missing, so a stale viewer is never
 * silently shipped.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

const HTML_PATH = join(ROOT, 'docs', 'architecture', 'viewer.html');
const DIAGRAMS_DIR = join(ROOT, 'docs', 'architecture', 'diagrams');

/**
 * The 7 (id, file) pairs that this script knows about. If you add a new
 * diagram, add it here AND to the HTML view with matching BEGIN/END markers.
 */
const DIAGRAMS: ReadonlyArray<{ id: string; viewId: string; file: string }> = [
  { id: 'c4-01-context', viewId: 'c4-context', file: 'c4-01-context.mmd' },
  { id: 'c4-02-container', viewId: 'c4-container', file: 'c4-02-container.mmd' },
  { id: 'c4-03-component', viewId: 'c4-component', file: 'c4-03-component.mmd' },
  { id: 'c4-04-frontend', viewId: 'c4-frontend', file: 'c4-04-frontend-component.mmd' },
  { id: 'seq-01-auth', viewId: 'seq-auth', file: 'seq-01-auth-webhook.mmd' },
  { id: 'seq-02-theory', viewId: 'seq-theory', file: 'seq-02-theory-ai-scoring.mmd' },
  { id: 'seq-03-coding', viewId: 'seq-coding', file: 'seq-03-piston-sandbox.mmd' },
] as const;

function fail(msg: string): never {
  console.error(`\u2717 build:viewer \u2014 ${msg}`);
  process.exit(1);
}

function main() {
  const checkOnly = process.argv.includes('--check');

  // 1. Sanity: the diagrams directory must exist and contain exactly the
  //    files we know about. Catches accidental rename / delete.
  const present = new Set(readdirSync(DIAGRAMS_DIR));
  for (const d of DIAGRAMS) {
    if (!present.has(d.file)) {
      fail(`missing diagram file: ${join(DIAGRAMS_DIR, d.file)}`);
    }
  }

  // 2. Read the HTML once.
  let html = readFileSync(HTML_PATH, 'utf-8');

  // 3. For each diagram, compute the new <pre> block and detect drift.
  let changedCount = 0;
  const drifted: string[] = [];
  for (const d of DIAGRAMS) {
    const mmdPath = join(DIAGRAMS_DIR, d.file);
    const mmd = readFileSync(mmdPath, 'utf-8').replace(/\r\n/g, '\n').trimEnd();

    const newBlock = `<pre class="mermaid" data-src="diagrams/${d.file}">${mmd}\n</pre>`;

    const preRegex = new RegExp(
      `<pre class="mermaid" data-src="diagrams/${escapeForRegex(d.file)}">[\\s\\S]*?<\\/pre>`,
      'm'
    );
    const m = html.match(preRegex);
    if (!m) {
      fail(
        `could not find <pre data-src="diagrams/${d.file}"> in ${HTML_PATH}. ` +
          `Did you forget to add it to the HTML?`
      );
    }

    if (m[0] !== newBlock) {
      changedCount += 1;
      drifted.push(d.file);
      if (!checkOnly) {
        html = html.replace(preRegex, newBlock);
      }
    }
  }

  // 4. Write back (or fail in check mode).
  if (checkOnly) {
    if (changedCount > 0) {
      console.error(
        `\u2717 build:viewer:check \u2014 ${changedCount} diagram(s) out of date in architecture-viewer.html:`
      );
      for (const f of drifted) console.error(`    - ${f}`);
      console.error(`  Run \`pnpm build:viewer\` to update.`);
      process.exit(1);
    }
    console.log(`\u2713 build:viewer:check \u2014 architecture-viewer.html is up to date`);
    return;
  }

  if (changedCount > 0) {
    writeFileSync(HTML_PATH, html, 'utf-8');
    console.log(`\u2713 build:viewer \u2014 inlined ${changedCount} diagram(s) into viewer.html`);
  } else {
    console.log(`\u2713 build:viewer \u2014 already up to date (no changes)`);
  }
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();
