/**
 * Root ESLint flat config (ESLint v9).
 *
 * Replaces the legacy `ui/eslint.config.js` (which only had 16 lines of
 * defaults). Single source of truth for both `server/` (Node/TS) and
 * `ui/` (browser/TSX) with project-specific rules:
 *
 *  - Frontend 7-layer N-Tier model enforced via `no-restricted-imports` —
 *    see `docs/architecture/frontend-refactor.md` §2 and the
 *    `architect-review` skill for the canonical violation list.
 *  - Backend NestJS module boundaries enforced — see
 *    `docs/architecture/architecture.md` §3.
 *  - `reportUnusedDisableDirectives: 'error'` replaces the need for the
 *    `eslint.debt.js` suppression ratchet.
 *
 * Run from the repo root:  pnpm lint
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.next/**',
      '**/build/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/blob-report/**',
      '.remember/**',
      'piston-cli/**',
      'docs/architecture/viewer.html', // generated artifact
      'scripts/build-architecture-viewer.ts', // requires tsx to lint
      'server/src/generated/**', // Prisma-generated client code
    ],
  },

  // ── Base recommended JS + TS rules ───────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Node & Root Configs: Node globals, no React ─────────────────
  {
    files: [
      'server/**/*.ts',
      '*.js',
      'release.config.cjs',
      'types/**/*.ts',
      'scripts/**/*.ts',
      'scripts/**/*.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Backend NestJS module boundaries — see `docs/architecture/architecture.md` §3.
      // Modules own their own controller/service/DTO. They may import:
      //   - their own files (no restriction)
      //   - other modules only through their public DI surface (NestJS module imports)
      //   - @/common, @prisma/client
      // They may NOT import from another module's internals.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['server/src/modules/*/!(dto)/**', '!server/src/modules/*/dto/**'],
              message:
                "Do not deep-import another NestJS module's internals. Import the module's public surface via its index.ts/dto barrel, or use NestJS DI (imports: [OtherModule]).",
            },
          ],
        },
      ],
    },
  },

  // ── UI: browser globals + React hooks ───────────────────────────
  {
    files: ['ui/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── Frontend 7-layer N-Tier model (per `frontend-refactor.md` §2) ──
      // The architect-review skill enforces these. We surface the cheap
      // ones (literal import violations) here so they fail at lint time,
      // not at review time.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // components/ must not import from data/ or logic/
            {
              group: ['@/data/*', '@/data', '@/logic/*', '@/logic'],
              message:
                'components/ is presentational only. Import data via a Reader hook in pages/ or a Command hook in a container. See docs/architecture/frontend-refactor.md §2.',
            },
            // data/ must not import from logic/ (circular layer)
            {
              group: ['@/logic/*', '@/logic'],
              message:
                'data/ cannot import from logic/ — that would be a circular layer. See docs/architecture/frontend-refactor.md §2.',
            },
            // utils/ is a leaf — no layer imports allowed
            {
              group: [
                '@/data/*',
                '@/data',
                '@/logic/*',
                '@/logic',
                '@/components/*',
                '@/components',
                '@/pages/*',
                '@/pages',
                '@/core/*',
                '@/core',
                '@/service/*',
                '@/service',
              ],
              message:
                'utils/ is a leaf layer. It cannot import from any other ui/ layer. See docs/architecture/frontend-refactor.md §4.2.',
            },
            // core/ is the bottom — no layer imports allowed
            {
              group: [
                '@/data/*',
                '@/data',
                '@/logic/*',
                '@/logic',
                '@/components/*',
                '@/components',
                '@/pages/*',
                '@/pages',
                '@/utils/*',
                '@/utils',
                '@/service/*',
                '@/service',
              ],
              message:
                'core/ is the bottom layer. It cannot import from any other ui/ layer. See docs/architecture/frontend-refactor.md §4.1.',
            },
            // pages/ is the seam — it can import from anywhere, but the
            // lint rule above already prevents data/ and logic/ from being
            // imported anywhere except pages/. So this is allowed by default.
          ],
        },
      ],
    },
  },

  // ── Global rule tuning ──────────────────────────────────────────
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // TypeScript hygiene
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn', // hard error would be too strict; let `react-developer` skill handle it in review

      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  }
);
