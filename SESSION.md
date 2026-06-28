# Session Log — PrepAI Full Stack Setup

Date: 2026-06-28

---

## What We Built

Scaffolded the entire frontend (`ui/`) and backend (`server/`) for PrepAI, configured tooling, set up E2E testing, documented the project, and prepared the monorepo structure.

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
└── server/                           # Backend (NestJS + Fastify)
    ├── .gitignore
    ├── nest-cli.json
    ├── package.json
    ├── pnpm-lock.yaml
    ├── pnpm-workspace.yaml
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── vitest.config.ts
    ├── vitest.config.e2e.ts
    ├── prisma/
    │   ├── schema.prisma             # MongoDB (User, Topic, Question, ChatMessage)
    │   └── schema.postgresql.prisma  # PostgreSQL (PracticeSession, Answer)
    └── src/
        ├── main.ts                   # Bootstrap (NestFactory + configureApp + listen)
        ├── app.module.ts             # Root module (Config, Logger, Cache, Prisma, Health)
        ├── config/
        │   ├── index.ts              # Barrel exports
        │   ├── app.config.ts         # registerAs('app') with validation
        │   ├── configure-app.ts      # Centralized app setup (Logger, plugins, Swagger)
        │   ├── env.validation.ts     # Zod schema for env vars
        │   ├── fastify.config.ts     # registerFastifyPlugins (helmet, cors, rate-limit, multipart)
        │   ├── logger-config.ts      # Pino HTTP config
        │   ├── middleware.config.ts   # MiddlewareConfig type
        │   └── swagger.config.ts     # setupSwagger (DocumentBuilder + SwaggerUI)
        ├── common/
        │   ├── index.ts              # Barrel exports
        │   ├── constants/
        │   │   ├── index.ts
        │   │   └── api.constants.ts  # ApiTags, ApiRoutes, messages
        │   ├── decorators/
        │   │   ├── index.ts
        │   │   ├── current-user.decorator.ts
        │   │   ├── public.decorator.ts
        │   │   └── roles.decorator.ts
        │   ├── filters/
        │   │   ├── index.ts
        │   │   └── http-exception.filter.ts
        │   ├── guards/
        │   │   ├── index.ts
        │   │   ├── clerk-auth.guard.ts
        │   │   └── roles.guard.ts
        │   ├── interceptors/
        │   │   ├── index.ts
        │   │   └── transform.interceptor.ts
        │   ├── middleware/
        │   │   ├── index.ts
        │   │   ├── logger.middleware.ts    # Pino request/response logging
        │   │   └── sanitize.middleware.ts  # Trims string inputs
        │   └── types/
        │       └── index.ts
        ├── modules/
        │   └── health/
        │       ├── health.module.ts
        │       ├── health.controller.ts
        │       └── health.controller.spec.ts
        ├── prisma/
        │   ├── prisma.module.ts
        │   └── prisma.service.ts     # PrismaService (MongoDB) + PrismaPostgresqlService
        └── types/
            ├── index.ts
            ├── user.types.ts         # IUserPayload, UserRole
            └── response.types.ts     # IResponse<T>
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

## Backend Setup (`server/`)

### 20. NestJS Backend Scaffolding

Scaffolded a production-ready NestJS backend in `server/` with:

**Packages installed** (exact pinned versions):
- NestJS 11.1.26 (common, core, config, platform-fastify, swagger, event-emitter, schedule, cache-manager)
- Fastify 5.8.5 with plugins (cors, helmet, rate-limit, multipart, static)
- Prisma 6.19.0 (client + CLI)
- Clerk SDK 5.1.6
- Mastra Core 1.41.0
- Google AI SDK 1.2.12
- Redis (ioredis 5.11.1, cache-manager 7.2.8)
- Pino logging (nestjs-pino 4.6.1, pino 10.3.1)
- Zod 4.4.3, class-validator, class-transformer
- Vitest 4.1.8 with SWC, coverage-v8
- TypeScript 6.0.3

**Config files created:**
- `package.json` — `"type": "module"`, all exact versions, no `^`/`~`
- `tsconfig.json` — `strict: true`, `module: NodeNext`, `emitDecoratorMetadata`, `@/*` alias
- `tsconfig.build.json` — extends tsconfig.json
- `nest-cli.json`
- `pnpm-workspace.yaml` — allowBuilds for prisma, swc, clerk
- `vitest.config.ts` — SWC plugin, jsdom, coverage thresholds
- `vitest.config.e2e.ts` — e2e test config
- `.env.example`
- `.gitignore`

**Prisma schemas:**
- `prisma/schema.prisma` — MongoDB (User, Topic, Question, ChatMessage)
- `prisma/schema.postgresql.prisma` — PostgreSQL (PracticeSession, Answer)

**Source structure (current state after user refactoring):**
- `src/main.ts` — Minimal bootstrap: NestFactory.create + configureApp + listen. No inline plugin/middleware setup
- `src/app.module.ts` — ConfigModule (Zod validate + `envFilePath` to root `.env`), LoggerModule, CacheModule (Redis via `redisStore`), PrismaModule, HealthModule. SanitizeMiddleware applied via `forRoutes('{*path}')`
- `src/config/configure-app.ts` — **Centralized app setup**: `app.useLogger(app.get(Logger))` (Pino), `registerGlobalMiddleware(app)`, `registerFastifyPlugins(app)`, `setGlobalPrefix('api/v1')`, `setupSwagger(app)`, `enableShutdownHooks()`
- `src/config/app.config.ts` — `registerAs('app')` with DATABASE_URL validation (required in non-test), PORT, NODE_ENV, databaseUrl, postgresqlUrl
- `src/config/fastify.config.ts` — `registerFastifyPlugins(app)` — registers Helmet (CSP directives), CORS (`*` in dev, CSV in prod), rate-limit (10/min on `/api/v1/auth/`, 100/min elsewhere), multipart (10MB limit)
- `src/config/swagger.config.ts` — `setupSwagger(app)` — DocumentBuilder with BearerAuth, SwaggerUI with persistAuthorization, tryItOut, displayRequestDuration
- `src/config/logger-config.ts` — Pino HTTP config: pino-pretty in dev (translateTime, colorize), custom success message, debug level in dev / info in prod
- `src/config/middleware.config.ts` — MiddlewareConfig type definition
- `src/config/index.ts` — Barrel exports for all config files
- `src/common/constants/` — ApiTags (Health, Auth, Users, Topics, Questions, Sessions, Answers, Analytics, Chatbot), ApiRoutes, success/error message constants
- `src/common/decorators/` — @CurrentUser (param decorator), @Public (SetMetadata), @Roles (SetMetadata)
- `src/common/guards/` — ClerkAuthGuard (verifies Bearer token via `@clerk/clerk-sdk-node`, attaches user payload), RolesGuard (checks required roles)
- `src/common/filters/` — HttpExceptionFilter (wraps errors in IResponse format)
- `src/common/interceptors/` — TransformInterceptor (wraps responses in `{ success, message, data, path, timestamp }`)
- `src/common/middleware/sanitize.middleware.ts` — Trims string inputs in request body
- `src/common/middleware/logger.middleware.ts` — **New**: Pino-based request/response logging via `@InjectPinoLogger`, logs incoming requests and response status on finish
- `src/common/middleware/index.ts` — Exports SanitizeMiddleware + LoggerMiddleware
- `src/common/types/` — MiddlewareConfig interface
- `src/prisma/prisma.service.ts` — PrismaService (MongoDB, extends PrismaClient), PrismaPostgresqlService (PostgreSQL, graceful skip if `POSTGRESQL_URL` not set)
- `src/modules/health/` — HealthController (`@Public()` GET `/health` → `{ status: 'ok' }`), HealthModule
- `src/types/` — IUserPayload, UserRole enum, IResponse<T> interface

### 21. Delete Server-Level Env Files

- Deleted `server/.env.example` (`server/.env` didn't exist)
- Root-level `.env` and `.env.example` are the single source of truth for both `ui/` and `server/`

### 22. Fix ConfigModule to Read from Root `.env`

- Added `envFilePath: join(__dirname, '..', '..', '.env')` to ConfigModule in `app.module.ts`
- Uses `import.meta.url` → `fileURLToPath` → `dirname` to resolve at runtime
- Path resolves: `src/` → `server/` → project root

### 23. Root .env.example Verification

- Root `.env.example` already contained all frontend (`VITE_*`) and backend variables
- No changes needed

### 24. User Refactoring — Centralized App Setup

The user restructured the backend to centralize all app configuration:

- **main.ts simplified**: Removed inline helmet/cors/rate-limit/multipart registrations, ValidationPipe, ExceptionFilter, TransformInterceptor — all moved to `configure-app.ts`
- **configure-app.ts** became the single entry point for app setup: Logger (Pino), global middleware, Fastify plugins, route prefix, Swagger, shutdown hooks
- **fastify.config.ts** changed from returning options object to `registerFastifyPlugins(app)` — registers plugins directly on the app instance
- **swagger.config.ts** changed from returning config object to `setupSwagger(app)` — creates document and mounts SwaggerUI with custom options
- **app.config.ts** added manual DATABASE_URL validation (required in non-test) inside `registerAs`
- **logger-config.ts** enhanced with custom formatting (translateTime, ignore pid/hostname, colorize) and `customSuccessMessage`
- **LoggerMiddleware added**: New Pino-based middleware using `@InjectPinoLogger` for request/response logging
- **app.module.ts** updated: Removed EventEmitterModule, ScheduleModule; added `envFilePath`, `forRoutes('{*path}')`, `appConfig`/`loggerConfig` imports
- **Rate limiting**: Stricter controls — 10/min on `/api/v1/auth/`, 100/min elsewhere

### 25. Prisma Generate

- Ran `pnpm prisma:generate` to generate both MongoDB and PostgreSQL Prisma clients
- MongoDB client generated to `node_modules/.prisma/client`
- PostgreSQL client generated to `src/generated/postgresql-client/`

### 26. Logger Error Fix

- `app.get(Logger)` fails because `nestjs-pino` overrides the Logger token differently
- Fixed by using static `Logger.log(...)` in `main.ts` instead of resolving from container
- `configure-app.ts` uses `app.useLogger(app.get(Logger))` which works because it's called after the container is fully initialized

### 27. Route Wildcard Fix

- `forRoutes('*')` causes path-to-regexp warnings in newer Fastify/NestJS
- Fixed to `forRoutes('{*path}')` — named parameter syntax

### 28. Weather Module — Mastra + NVIDIA NIM Integration

Created a sample weather agent module to verify Mastra + NVIDIA NIM integration:

**Package installed:**
- `@ai-sdk/openai@3.0.77` (v3, compatible with Mastra 1.41.0 — v4 causes LanguageModelV4/v3 mismatch)

**Files created:**
- `src/mastra/index.ts` — Mastra singleton with weatherAgent registered
- `src/modules/weather/weather.agent.ts` — Agent definition with `createOpenAI` (NVIDIA NIM provider), `createTool` for `getWeather` (Open-Meteo geocoding + weather API), native `fetch` only
- `src/modules/weather/weather.service.ts` — NestJS service using `mastra.getAgent('weatherAgent')` + `agent.generate()`
- `src/modules/weather/weather.controller.ts` — `@Public()` POST `/weather/ask` endpoint with Swagger decorators
- `src/modules/weather/weather.module.ts` — Module wiring controller + service
- `src/modules/weather/dto/ask-weather.dto.ts` — class-validator DTO with `@ApiProperty`
- `src/modules/weather/dto/index.ts` — Barrel export

**Config changes:**
- Root `.env.example` — added `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL`
- `env.validation.ts` — added 3 Zod fields with defaults
- `app.module.ts` — imported and registered `WeatherModule`

**TypeScript fixes:**
- `Agent` and `createTool` import from subpaths (`@mastra/core/agent`, `@mastra/core/tools`)
- Agent requires `id` field in v1.41.0
- DTO property needs `!` assertion for strict mode
- Execute function parameter needs explicit type annotation

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

### Backend

- [x] No `^` or `~` in server `package.json`
- [x] `"type": "module"` in server `package.json`
- [x] `pnpm-lock.yaml` exists in `server/`
- [x] `pnpm-workspace.yaml` exists in `server/`
- [x] `tsconfig.json` has `strict: true`, `module: NodeNext`, `emitDecoratorMetadata: true`
- [x] `tsconfig.build.json` extends `tsconfig.json`
- [x] `nest-cli.json` exists
- [x] `vitest.config.ts` and `vitest.config.e2e.ts` both exist
- [x] Both Prisma schemas exist (`schema.prisma` MongoDB, `schema.postgresql.prisma`)
- [x] All `.js` extensions used in TypeScript imports
- [x] `pnpm exec tsc --noEmit` exits with zero errors
- [x] `pnpm test` — health controller spec passes
- [x] ClerkAuthGuard verifies Bearer tokens via `@clerk/clerk-sdk-node`
- [x] Health endpoint at `/health` returns `{ status: 'ok' }`
- [x] Swagger configured at `/docs` (non-production only) with BearerAuth + custom UI options
- [x] `server/.env` and `server/.env.example` do not exist
- [x] ConfigModule `envFilePath` points to root `.env`
- [x] Root `.env.example` has all frontend + backend variables
- [x] `configure-app.ts` centralizes all app setup (Logger, middleware, plugins, prefix, Swagger, shutdown)
- [x] `fastify.config.ts` registers plugins directly on app instance
- [x] LoggerMiddleware added for request/response logging via Pino
- [x] `forRoutes('{*path}')` — no path-to-regexp warnings
- [x] Rate limiting: 10/min on auth, 100/min elsewhere
- [x] `main.ts` uses static `Logger.log()` — no `app.get(Logger)` container resolution
- [x] Prisma clients generated (MongoDB + PostgreSQL)
- [x] `pnpm start:dev` starts without errors
- [x] `@ai-sdk/openai@3.0.77` installed (v3, compatible with Mastra 1.41.0)
- [x] Root `.env.example` has NVIDIA vars (API_KEY, BASE_URL, MODEL)
- [x] `env.validation.ts` has NVIDIA Zod fields with defaults
- [x] `src/mastra/index.ts` exists with Mastra singleton
- [x] `weather.agent.ts` uses `createOpenAI` with NVIDIA NIM baseURL
- [x] `getWeather` tool calls Open-Meteo geocoding then weather API
- [x] `weather.service.ts` uses `mastra.getAgent('weatherAgent')`
- [x] `weather.controller.ts` is `@Public()` — no auth required
- [x] `WeatherModule` registered in `app.module.ts`

### 29. Mastra Integration, Bug Fixes & Tech Expert Agent Setup

We integrated the new `techExpertAgent` module and resolved various compiler, dependency injection, and runtime issues in the ESM NestJS server:

1. **Resolved Watch Mode Deletion Conflict**:
   - Disabled `"incremental"` compilation in `tsconfig.json` to prevent Nest CLI's `"deleteOutDir": true` watch behavior from deleting necessary compiled files while TypeScript skips re-emitting them.

2. **Fixed Weather Service Spec Tests**:
   - Corrected the mock path in [weather.service.spec.ts](file:///c:/antigravity-test/PrepAI/server/src/modules/weather/weather.service.spec.ts) from `../mastra/mastra.config.js` to `../../mastra/mastra.config.js` so Vitest targets the mock correctly.
   - Fixed `mockGetAgent` to be synchronous (returning the mocked agent directly instead of wrapping it in `Promise.resolve`) to match the real Mastra API.

3. **Removed and Restored Mastra Integration**:
   - Safely deleted the weather module and weather agent as requested, removing `@mastra/*` dependencies.
   - Restored Mastra by adding `@mastra/core` (using version `1.47.0` to resolve a database harness session export mismatch in `@mastra/libsql@1.14.2`) and `@ai-sdk/openai`.
   - Wired the new [tech-expert-agent.ts](file:///c:/antigravity-test/PrepAI/server/src/mastra/agents/tech-expert-agent.ts) to use `process.env` directly for API keys and base URLs.
   - Created and registered `TechExpertModule` in [app.module.ts](file:///c:/antigravity-test/PrepAI/server/src/app.module.ts).

4. **Fixed ESM Watch Mode Path Alias Resolution**:
   - Discovered that Nest's default watch compiler (`nest start --watch`) fails to resolve `@/` path aliases in ESM mode.
   - Updated `start:dev` script to use `@swc-node/register` (`node --import @swc-node/register/esm-register --watch src/main.ts`) which supports both native Node ESM watch mode and TS decorator metadata emission.

5. **Implemented ZodValidationPipe**:
   - Created [zod-validation.pipe.ts](file:///c:/antigravity-test/PrepAI/server/src/common/pipes/zod-validation.pipe.ts) to handle runtime request body validations.
   - Fixed compiler error TS1272 by using `import type { ZodSchema }` instead of class imports to satisfy `isolatedModules`.
   - Registered and exported it globally in the common barrel file.

6. **Fixed DTO Whitelisting**:
   - Added class-validator decorators (`@IsString()`, `@IsNotEmpty()`) to `TechExpertRequestDto` inside [tech-expert.types.ts](file:///c:/antigravity-test/PrepAI/server/src/modules/tech-expert/tech-expert.types.ts) to prevent Nest's whitelisting ValidationPipe from discarding incoming request properties.

7. **Resolved Upstream LLM Race Condition**:
   - Added the `--env-file=../.env` flag to Node startup to load the API keys *before* module evaluation. This ensures `process.env.NVIDIA_API_KEY` is already populated when `tech-expert-agent.ts` evaluates statically at module import time.
