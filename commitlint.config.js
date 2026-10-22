/**
 * Conventional Commits enforcement for PrepAI.
 *
 *   - `type`: required, must be one of the conventional types.
 *   - `scope`: optional, but if used must be one of the registered scopes
 *     (the actual areas of the repo a commit can touch).
 *   - `subject`: required, lowercase first letter, no trailing period,
 *     max 72 chars.
 *
 * Scopes cover:
 *   - server, ui           — the two product packages
 *   - e2e                  — root-level Playwright E2E
 *   - root                 — root-level config (package.json, tsconfig.json,
 *                            .github/, .gitignore, etc.)
 *   - deps                 — dependency bumps in any package
 *   - config               — tooling config (eslint, prettier, husky, etc.)
 *   - docs                 — docs/ folder
 *   - skills               — .claude/skills/ folders (root, ui/, server/)
 *   - agents               — .claude/agents/ folder
 *   - arch                 — architecture docs / ADRs / diagrams
 *
 * Use a scope. Free-form scopes like `frontend`, `backend`, `api` are
 * not allowed — pick the closest match from the list above. This keeps
 * the changelog and the git history scannable.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['server', 'ui', 'e2e', 'root', 'deps', 'config', 'docs', 'skills', 'agents', 'arch'],
    ],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 72],
  },
};
