/**
 * Root Prettier config — single source of truth for both `server/` and
 * `ui/`. The `server/package.json` previously ran Prettier with
 * defaults (no config existed). Run from the repo root:
 *
 *   pnpm format          # write
 *   pnpm format:check    # CI / pre-commit gate
 *
 * Per `.gitattributes`, all files are LF. `endOfLine: 'lf'` is a
 * belt-and-suspenders in case a contributor's editor overrides.
 */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  // Markdown is hand-written documentation; let it breathe at 100 cols
  // like the rest. Override per-file with `<!-- prettier-ignore -->` if
  // a table or code block needs to be left alone.
  overrides: [
    {
      files: ['*.md', '*.mdx'],
      options: { proseWrap: 'preserve' },
    },
  ],
};
