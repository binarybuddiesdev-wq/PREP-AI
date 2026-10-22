import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Name the tsconfig root explicitly; see the root `eslint.config.js` for why.
const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

// Layer boundaries from ADR-0009 (docs/architecture/frontend-refactor.md §1).
// Each layer may import only the layers listed in `allowed`; everything else is rejected.
const LAYERS = ['core', 'utils', 'service', 'data', 'logic', 'components', 'pages', 'app'];

const layerRule = (layer, allowed, extraForbidden = []) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...LAYERS.filter((other) => other !== layer && !allowed.includes(other)).map((other) => ({
            group: [`@/${other}`, `@/${other}/*`],
            message: `${layer}/ cannot import from ${other}/. See docs/architecture/frontend-refactor.md §1.`,
          })),
          ...extraForbidden,
        ],
      },
    ],
  },
});

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { tsconfigRootDir },
    },
  },
  layerRule('core', []),
  layerRule('utils', ['core']),
  layerRule('service', ['core', 'utils']),
  layerRule('data', ['core', 'utils']),
  layerRule('logic', ['core', 'utils', 'service', 'data']),
  layerRule('components', ['core', 'utils']),
  // pages may use the Clerk widgets from service/auth, but never the HTTP client or the store directly.
  layerRule(
    'pages',
    ['core', 'utils', 'logic', 'components', 'service'],
    [
      {
        group: ['@/service/api', '@/service/api/*'],
        message: 'pages/ go through a Reader or Command hook in logic/, not service/api.',
      },
    ]
  ),
  {
    ignores: ['dist'],
  }
);
