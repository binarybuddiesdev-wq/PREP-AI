# Session Log — PrepAI Frontend Setup

Date: 2026-06-28

---

## What We Built

Scaffolded the entire frontend base project for PrepAI, configured tooling, set up E2E testing, documented the project, and prepared the monorepo structure.

---

## Step-by-Step Progress

### 1. Frontend Scaffolding (`ui/`)

- Initialized Vite + React + TypeScript project using `pnpm create vite@latest . --template react-ts`
- Installed all production dependencies with **exact pinned versions** (no `^` or `~`):
  - React 19.2.7, React DOM 19.2.7
  - React Router 8.0.1
  - Redux Toolkit 2.12.0, React Redux 9.3.0
  - TanStack Query 5.101.2
  - ky 2.0.2, Zod 4.4.3
  - React Hook Form 7.80.0, @hookform/resolvers 5.4.0
  - Clerk (@clerk/clerk-react) 5.61.3
  - @fontsource/dm-sans 5.2.8, @fontsource/jetbrains-mono 5.2.8
  - lucide-react 1.21.0, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.6.0, tailwindcss-animate 1.0.7
- Installed dev dependencies:
  - Vitest 4.1.9, @testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1, jsdom 29.1.1
  - Tailwind CSS 4.3.1, @tailwindcss/vite 4.3.1
  - ESLint 10.6.0, typescript-eslint 8.62.0
  - TypeScript 6.0.3, Vite 8.1.0

### 2. Configuration Files (`ui/`)

- **`vite.config.ts`**: `@` path alias pointing to `src/`, Tailwind CSS v4 plugin, Vitest config (jsdom, globals, setupFiles)
- **`tsconfig.json`**: baseUrl `.`, path alias `@/*` → `src/*`
- **`tsconfig.app.json`**: `strict: true`, path alias, bundler module resolution
- **`tsconfig.node.json`**: `strict: true`, path alias for vite.config.ts
- **`eslint.config.js`**: typescript-eslint flat config

### 3. Shadcn UI Setup

- Ran `pnpm dlx shadcn@latest init --defaults --force`
- Generated `components.json` (base-nova style, neutral base color, CSS variables)
- Created `src/lib/utils.ts` with `cn()` utility (clsx + tailwind-merge)
- Installed Shadcn Button component via `pnpm dlx shadcn@latest add button`
- Installed additional Shadcn dependencies: @base-ui/react, tw-animate-css

### 4. Provider Setup (`ui/src/main.tsx`)

Wired 4 providers in order (outermost to innermost):
1. `ClerkProvider` — reads `VITE_CLERK_PUBLISHABLE_KEY` from env, only renders when key exists
2. `Provider` (Redux) — wraps the Redux store
3. `QueryClientProvider` (TanStack Query)
4. `BrowserRouter` (React Router)

### 5. Redux Store (`ui/src/store/index.ts`)

- Created `configureStore` with `combineReducers` (valid reducer required by Redux Toolkit)
- Exported `RootState` and `AppDispatch` types

### 6. App Component (`ui/src/App.tsx`)

- Restored the exact Vite template code (hero section, counter, documentation/social links)
- Swapped `<button>` with Shadcn `<Button variant="outline">` to verify Shadcn works

### 7. CSS Setup (`ui/src/index.css`)

- Added `@import "tailwindcss"` for Shadcn components
- Preserved original Vite template CSS variables and styles

### 8. Test Setup (`ui/src/test/setup.ts`)

- Created with `@testing-library/jest-dom/vitest` import

### 9. Environment Variables

- Created `.env.example` at root level with:
  - `VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here`
  - `VITE_API_BASE_URL=http://localhost:3000`
- `.env` also at root level

### 10. Package Scripts (`ui/package.json`)

```json
"dev": "vite",
"build": "tsc && vite build",
"preview": "vite preview",
"test": "vitest",
"test:ui": "vitest --ui",
"lint": "eslint . --ext ts,tsx"
```

### 11. Root-Level Playwright Setup

- Created `package.json` at root with `@playwright/test` 1.52.0, `@types/node` 22.15.3, `typescript` 5.8.3
- Created `tsconfig.json` at root with `"types": ["node"]` for `process.env` support
- Created `playwright.config.ts` with:
  - Separate projects: `ui`, `ui-chromium`, `server`, `server-chromium`
  - `testDir`: `./e2e/ui` and `./e2e/server`
  - `webServer`: starts both `ui` (port 5173) and `server` (port 3000)
  - Trace, screenshot, video on failure
- Root `package.json` scripts:
  - `test`, `test:ui`, `test:server`, `test:chromium`, `report`

### 12. E2E Test Structure

- `e2e/ui/smoke.spec.ts` — frontend smoke tests (homepage loads, hero renders)
- `e2e/server/smoke.spec.ts` — backend smoke tests (health endpoint)

### 13. Dashboard Screenshot

- Used Playwright to screenshot the dashboard from `prepai-ui.html`
- Saved to `public/dashboard.png`
- Referenced in `README.md`

### 14. README.md

- Comprehensive documentation with:
  - Project overview, dashboard screenshot
  - Table of contents
  - All 11 screens documented in detail (Landing, Auth, Dashboard, Practice, Question Bank, Coding, History, Settings, Library, Chatbot, Global Features)
  - Full tech stack table with versions
  - Project structure tree
  - Getting started guide
  - Testing instructions (unit + E2E)
  - UI prototype description

### 15. Root `.gitignore`

Covers: node_modules, .env, dist, test-results, playwright-report, IDE files, OS files, logs, tsbuildinfo

---

## Project Structure

```
PrepAI/
├── .env                              # Environment variables (root level)
├── .env.example                      # Environment variable template
├── .gitignore                        # Root gitignore
├── GEMINI.md
├── SESSION.md                        # This file
├── package.json                      # Root package (Playwright E2E)
├── pnpm-lock.yaml                    # Root lockfile
├── playwright.config.ts              # Playwright config (ui + server)
├── prepai-ui.html                    # Full standalone UI prototype
├── README.md                         # Project documentation
├── tsconfig.json                     # Root TypeScript config
│
├── public/
│   └── dashboard.png                 # Dashboard screenshot for README
│
├── e2e/
│   ├── ui/
│   │   └── smoke.spec.ts            # Frontend E2E tests
│   └── server/
│       └── smoke.spec.ts            # Backend E2E tests
│
├── ui/                               # Frontend (React + Vite)
│   ├── .env                          # (referenced from root)
│   ├── .gitignore
│   ├── components.json               # Shadcn UI config
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── App.css
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── assets/
│       │   ├── hero.png
│       │   ├── react.svg
│       │   └── vite.svg
│       ├── components/
│       │   └── ui/
│       │       └── button.tsx        # Shadcn Button
│       ├── lib/
│       │   └── utils.ts              # cn() utility
│       ├── store/
│       │   └── index.ts              # Redux store
│       └── test/
│           └── setup.ts              # Vitest setup
│
└── server/                           # Backend (empty, to be set up)
```

---

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Package manager | pnpm | Per spec, never npm/yarn |
| Version pinning | Exact (no ^ or ~) | Prevents unexpected breaks |
| Clerk conditionally rendered | Only when key exists | App runs without `.env` configured |
| Redux store has placeholder reducer | `combineReducers` with dummy | Redux Toolkit rejects empty `reducer: {}` |
| Tailwind import in index.css | `@import "tailwindcss"` | Required for Shadcn components to work |
| E2E folders named `ui`/`server` | Matches project structure | Consistent naming across monorepo |
| Env files at root level | Shared across ui/server | Single source of truth |
| Playwright config at root | Single config for both projects | Unified test runner |
| Root tsconfig for Playwright | `"types": ["node"]` | Resolves `process.env` type errors |
| Vite envDir | `path.resolve(__dirname, '..')` | Reads `.env` from root, shared by ui/server |
| No baseUrl in tsconfigs | Removed `baseUrl`, use `"./src/*"` | TypeScript 6 deprecated baseUrl |
| tsconfig.json strict | Added `"strict": true` | Ensures strict mode across all referenced configs |

### 16. Vite Env Dir Fix (`ui/vite.config.ts`)

- Added `envDir: path.resolve(__dirname, '..')` so Vite reads `.env` from the project root instead of `ui/`
- This allows both `ui/` and `server/` to share the same `.env` file at root level

### 18. Vitest Config Separation

- Created `ui/vitest.config.ts` as a standalone config file
- Moved test configuration out of `vite.config.ts` into `vitest.config.ts`
- `vitest.config.ts` includes: `@` path alias, jsdom environment, globals enabled, setupFiles pointing to `src/test/setup.ts`
- `vite.config.ts` now only has build/dev config (plugins, envDir, resolve alias)

### 17. TypeScript Strict Mode + baseUrl Deprecation Fix

- Added `"strict": true` to `ui/tsconfig.json` (compilerOptions block)
- Removed deprecated `baseUrl` from all three tsconfigs (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`) — TypeScript 6 flags it as deprecated
- Updated path aliases to use relative paths (`"./src/*"` instead of `"src/*"`)
- Verified `pnpm exec tsc --noEmit` exits with zero errors

### 19. Clerk Publishable Key Validation Fix

**Error:** App crashed in browser with:
```
@clerk/clerk-react: The publishableKey passed to Clerk is invalid.
(key=your_clerk_publishable_key_here)
```

**Root cause:** The `.env` file has a placeholder value `VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here`. The previous check `clerkPubKey` was truthy for this string, so ClerkProvider rendered with an invalid key. Clerk validates the key format and throws.

**Fix in `ui/src/main.tsx`:**
- Added regex validation: `const isClerkValid = clerkPubKey && /^pk_(test|live)_/.test(clerkPubKey)`
- Changed condition from `clerkPubKey ?` to `isClerkValid ?`
- ClerkProvider now only renders when the key starts with `pk_test_` or `pk_live_`
- Placeholder value is ignored, app runs without Clerk when no valid key is set

---

## Verification Checklist

- [x] No `^` or `~` in any `package.json` dependency
- [x] `pnpm-lock.yaml` exists (root + ui)
- [x] `tsconfig.json` has `strict: true`
- [x] `tsconfig.app.json` has `strict: true`
- [x] `tsconfig.node.json` has `strict: true`
- [x] Path alias `@` configured in `vite.config.ts` and all tsconfigs
- [x] `envDir` in `vite.config.ts` points to root for `.env` resolution
- [x] `src/test/setup.ts` exists
- [x] `src/main.tsx` has all 4 providers (Clerk → Redux → Query → Router)
- [x] `.env.example` at root with both keys
- [x] `pnpm dev` runs without errors
- [x] Shadcn Button component works in App.tsx
- [x] TypeScript compiles clean (`tsc --noEmit` — zero errors)
- [x] Playwright config compiles clean with `process.env`
- [x] Dashboard screenshot in `public/dashboard.png`
- [x] E2E test structure: `e2e/ui/` and `e2e/server/`
- [x] Root `.gitignore` covers all generated files
- [x] No `baseUrl` deprecation warnings in any tsconfig
- [x] `vitest.config.ts` exists with test config separated from vite.config.ts
- [x] Clerk key validated with regex — placeholder values don't crash the app
