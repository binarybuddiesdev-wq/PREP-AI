/**
 * Root ESLint flat config (ESLint v9).
 *
 * Replaces the legacy `ui/eslint.config.js` (which only had 16 lines of
 * defaults). Single source of truth for both `server/` (Node/TS) and
 * `ui/` (browser/TSX) with project-specific rules:
 *
 *  - Frontend layer boundaries live in `ui/eslint.config.js`
 *    (see `docs/architecture/frontend-refactor.md` §1).
 *  - Backend NestJS module boundaries enforced — see
 *    `docs/architecture/architecture.md` §3.
 *  - `reportUnusedDisableDirectives: 'error'` replaces the need for the
 *    `eslint.debt.js` suppression ratchet.
 *
 * Run from the repo root:  pnpm lint
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// typescript-eslint refuses to guess when more than one ESLint config in the process
// registers a tsconfig root (this file and `ui/eslint.config.js`, which resolves
// `typescript-eslint` from here whenever `ui/node_modules` is not installed). Naming
// the root explicitly makes `pnpm lint` independent of which packages are installed.
const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

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

      // Frontend layer-boundary rules live in `ui/eslint.config.js`; ESLint 10 uses that
      // file for `ui/` files, so rules placed here would never apply to them.
    },
  },

  // ── Global rule tuning ──────────────────────────────────────────
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir },
    },
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
