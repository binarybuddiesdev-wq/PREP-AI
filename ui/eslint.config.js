import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Name the tsconfig root explicitly; see the root `eslint.config.js` for why.
const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { tsconfigRootDir },
    },
  },
  {
    ignores: ['dist'],
  }
);
