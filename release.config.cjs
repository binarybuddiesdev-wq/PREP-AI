/**
 * release-it config — Conventional-Commits-driven releases.
 *
 * `pnpm release-it` (or `release-it --ci` in CI) will:
 *   1. Read commit messages since the last tag.
 *   2. Bump the version (SemVer) per the Conventional Commits spec.
 *   3. Rewrite the `[Unreleased]` section of `CHANGELOG.md` into a
 *      dated `[x.y.z] — YYYY-MM-DD` block.
 *   4. Commit, tag, and push.
 *   5. Open a GitHub Release draft.
 *
 * Run `pnpm release-it --dry-run` to preview without side effects.
 *
 * Why not `standard-version` or `semantic-release`?
 *   - `release-it` runs locally without GitHub Actions tokens being
 *     mandatory; useful while the repo is still solo.
 *   - `release-it` lets us version-bump three `package.json` files at
 *     once via the `beforeStage` hook below.
 *   - We keep Conventional Commits enforced by `commitlint` in `.husky/`
 *     so the same messages drive both commit-lint and release notes.
 */

const RELEASE_FILES = ['package.json', 'server/package.json', 'ui/package.json'];

module.exports = {
  git: {
    requireBranch: false,
    requireCleanWorkingDir: true,
    requireCommits: true,
    push: true,
    tag: true,
    commitMessage: 'release: v${version}',
    tagAnnotation: 'Release v${version}',
  },

  gitlab: {
    releaseNotes: false,
  },

  github: {
    release: true,
    releaseName: 'v${version}',
    releaseNotes: true,
    autoGenerate: true,
  },

  npm: {
    publish: false, // we don't publish to npm — keep false
    skipChecks: true,
  },

  hooks: {
    'before:bump': ['pnpm format'],
    'after:bump': [
      // Bump the secondary package.json files so they stay in sync.
      async () => {
        const fs = await import('node:fs');
        const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        for (const file of RELEASE_FILES.slice(1)) {
          const json = JSON.parse(fs.readFileSync(file, 'utf8'));
          json.version = version;
          fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
        }
      },
    ],
    'before:release': ['pnpm format:check', 'pnpm lint'],
  },

  plugins: {
    '@release-it/conventional-changelog': {
      changelogPath: 'CHANGELOG.md',
      filenameConvention: 'YYYY-MM-DD',
      preset: {
        name: 'conventionalcommits',
        types: [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'perf', section: 'Performance' },
          { type: 'refactor', section: 'Refactors' },
          { type: 'docs', section: 'Documentation', hidden: false },
          { type: 'test', section: 'Tests', hidden: true },
          { type: 'build', section: 'Build System', hidden: false },
          { type: 'ci', section: 'CI', hidden: true },
          { type: 'chore', section: 'Chores', hidden: true },
          { type: 'style', section: 'Code Style', hidden: true },
        ],
      },
    },
  },

  // Skip work-in-progress bumps until we cut the first tag.
  // To release, run `pnpm release-it 0.1.0 --increment=minor --no-increment`.
};
