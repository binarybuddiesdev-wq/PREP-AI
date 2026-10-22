# Vitest setup and configuration

Reference for the `testing` skill. The Vitest, SWC and coverage configuration and the available scripts. Load when changing the config or debugging why a spec is not discovered.

## The testing setup at a glance

- **Framework:** Vitest 4.1.8 (not Jest)
- **Transpiler:** SWC via `unplugin-swc` (not ts-jest, not babel)
- **Module system:** ESM / NodeNext — both relative imports (`./`, `../`) AND path alias imports (`@/...`) SHOULD include the `.js` extension (e.g. `import { PrismaService } from '@/prisma/prisma.service.js'`).
- **Globals:** `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll` are all globally available (`globals: true` in vitest config). You do not need to import them. The TypeScript config (`tsconfig.json`) has `"types": ["vitest/globals"]`.
- **Mock framework:** `vi.fn()` exclusively. Never `jest.fn()`.
- **Coverage:** v8 provider, hard 90% thresholds on **lines**, **statements**, **functions**, and **branches**.
- **Path alias:** `@/` → `./src` via vitest alias config.

## The vitest configuration

### Unit tests — `vitest.config.ts`

```ts
// server/vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // ... alias, plugins, coverage
  },
});
```

- **`include`**: only `src/**/*.spec.ts`. Files outside `src/` are not
  discovered by this config.
- **Coverage reporter**: `['text', 'json', 'html']`.
- **Coverage excludes**: `src/main.ts`, `src/**/*.module.ts`,
  `src/**/*.types.ts`, `src/types/**/*`, `src/common/index.ts`,
  `src/prisma/index.ts`, `src/config/**/*`.
- **No custom matchers**, no `expect.extend(...)`, no setup file.

### E2E tests — `vitest.config.e2e.ts`

- **`include`**: `test/e2e/**/*.e2e-spec.ts`.
- The config exists and is wired (`pnpm test:e2e`), but **no e2e test
  files have been written yet**. When you write the first one, follow
  the structure of `vitest.config.e2e.ts` exactly.
- E2E tests are not instrumented (no coverage block in the e2e config).

### Available scripts (from `server/package.json`)

| Script               | What it does                               |
| -------------------- | ------------------------------------------ |
| `pnpm test`          | `vitest run` — unit tests once             |
| `pnpm test:watch`    | `vitest` — watch mode                      |
| `pnpm test:coverage` | `vitest run --coverage` — with v8 report   |
| `pnpm test:e2e`      | `vitest run --config vitest.config.e2e.ts` |
