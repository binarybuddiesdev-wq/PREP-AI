# PrepAI Software Architecture & System Design Blueprint

**Project: PrepAI Monorepo**  
**Classification: Comprehensive Technical Architecture, Layer Boundaries, Dependency Graph & Implementation Rules**

---

## 1. Executive Architecture Overview

### 1.1 Architectural Philosophy and Style

PrepAI is architected as a **Clean, Hexagonal, Modular Monolith** combining decoupled domain boundaries, dual-database persistence, isolated AI orchestration, sandboxed code execution, and CQRS-inspired client-side state separation.

The system synthesizes five core architectural paradigms:

1. **Ports and Adapters (Hexagonal Architecture):** Core business workflows (theory generation, answer evaluation, code assessment, user management) are decoupled from concrete delivery mechanisms (Fastify HTTP routes, Clerk auth webhooks, Redis cache transports, Piston sandboxes, Mastra LLM providers). Infrastructure communicates via strictly typed interfaces and dependency injection.
2. **Dual-Store Persistence Strategy:** Clean physical separation between:
   - **Document Store (MongoDB via `PrismaService`):** High-velocity, flexible schema domain models (Users, Topics, Questions, Settings).
   - **Relational & Vector Store (PostgreSQL via `PrismaPostgresqlService`):** Transactional sessions, historical answers, async job queues, analytics, and pgvector embeddings.
   - _Graceful Degradation:_ The PostgreSQL service initializes safely and no-ops gracefully when `POSTGRESQL_URL` is omitted.
3. **Mastra AI Orchestration with Provider Routing:** Multi-model failover pipeline (NVIDIA NIM primary, Groq / OpenAI fallbacks) providing deterministic structured outputs governed by Zod schemas.
4. **Sandboxed Code Execution Engine (Piston):** Containerized, rootless code execution isolated to IPv4 loopback (`127.0.0.1:2000`) with dynamic host cgroup controller detection.
5. **N-Tier CQRS-Inspired Client Separation (`ui/`):** Strict layer separation between:
   - **Core & Leaf Utils:** Pure shared types (`core/`) and stateless helper functions (`utils/`).
   - **Data Layer (`data/`):** API transport (`apiClient.ts`), query keys, response envelopes, and Redux Toolkit client store (`data/store/`).
   - **Service Layer (`service/`):** Third-party SDK adapters (Clerk, and future Cloudinary/Resend/Razorpay).
   - **Logic Layer (`logic/`):** Dedicated **Reader hooks** (`useXxxReader` wrapping `useQuery`) and **Command hooks** (`useXxxCommand` wrapping `useMutation`).
   - **Components Layer (`components/`):** Pure presentational UI widgets (never imports `data/` or `logic/`).
   - **Pages Layer (`pages/`):** Route views acting as composition roots.

> **Companion Documentation:**
>
> - Detailed Frontend Refactor Plan & File Inventory: [frontend-refactor.md](frontend-refactor.md)
> - Architectural Decision Record: [ADR 0008: Frontend N-Tier Architecture](../adr/0008-frontend-n-tier.md)

---

### 1.2 High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND APPLICATION (ui/)                               │
│  React 19  │  Vite  │  Tailwind CSS v4  │  Shadcn UI  │  Redux Toolkit  │  TanStack Query  │
│                                                                                        │
│  ┌───────────────────────────┐                 ┌────────────────────────────────────┐  │
│  │   UI Pages (Composition)  │                 │        Logic Layer (Hooks)         │  │
│  │  - DashboardPage          │ ──────────────> │  - useUserReader / useTopicsReader │  │
│  │  - InterviewPage          │  Reads / Writes │  - useUpdateSettingsCommand        │  │
│  └─────────────┬─────────────┘                 └─────────────────┬──────────────────┘  │
│                │ Composes Props                                  │ Dispatches          │
│                ▼                                                 ▼                     │
│  ┌───────────────────────────┐                 ┌────────────────────────────────────┐  │
│  │ Components (Presenter)    │                 │      Data Layer & Client Store     │  │
│  │  - Shadcn UI / UserCard   │                 │  - apiClient.ts (ky + Clerk JWT)   │  │
│  │  - Zero data/logic import │                 │  - data/store/ (Redux Toolkit)     │  │
│  └───────────────────────────┘                 └─────────────────┬──────────────────┘  │
└──────────────────────────────────────────────────────────────────┼─────────────────────┘
                                                                   │ HTTP / JSON Bearer
                                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BACKEND API GATEWAY (server/)                           │
│  NestJS 11  │  Fastify Adapter  │  Pino Structured Logger  │  ClerkAuth & Roles Guards  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     Presentation Layer (Controllers & DTOs)                      │  │
│  │  TopicController │ QuestionController │ TheoryController │ TechExpertController  │  │
│  └───────────────────────────┬───────────────────────────────────┬──────────────────┘  │
│                              │ Dispatches Request                │                      │
│                              ▼                                   ▼                      │
│  ┌─────────────────────────────────────────┐   ┌────────────────────────────────────┐  │
│  │         Application / Logic Layer       │   │           AI Agent Layer           │  │
│  │  - TopicService    - QuestionService    │   │  - Mastra AI Agents (Nemotron)     │  │
│  │  - TheoryService   - UserService        │   │  - Fallback Provider Router (LLM)  │  │
│  │  - EvaluationEngine - SessionManager    │   │  - Zod Schema Output Enforcers     │  │
│  └──────┬────────────────────┬─────────────┘   └─────────────────┬──────────────────┘  │
│         │                    │                                   │                      │
│         ▼                    ▼                                   ▼                      │
│  ┌──────────────┐   ┌──────────────────┐               ┌──────────────────┐            │
│  │ Redis Cache  │   │  MongoDB (Prisma)│               │PostgreSQL(Prisma)│            │
│  │ (ioredis)    │   │  Users, Topics,  │               │Sessions, Answers,│            │
│  │ Sessions/TTL │   │  Questions       │               │Analytics, Vectors│            │
│  └──────────────┘   └──────────────────┘               └──────────────────┘            │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │ HTTP REST (127.0.0.1:2000)
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           ISOLATED EXECUTION ENGINE (piston/)                          │
│  Piston Sandboxed API  │  Podman / WSL2 Custom Entrypoint  │  JS / TS / Python Runtimes  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Directory Structure

```
PREP-AI/
├── docs/
│   ├── architecture/
│   │   ├── architecture.md           # Master System Architecture Blueprint (This document)
│   │   ├── frontend-refactor.md      # Dedicated Frontend N-Tier Refactor Plan & Playbook
│   │   ├── services.md               # Service catalog, owners, dependencies, and SLOs
│   │   ├── nfrs.md                   # Non-functional requirements (latencies, availability)
│   │   └── README.md                 # Architecture Index & Diagrams Catalog
│   └── adr/                          # Architecture Decision Records (ADR 0001 - 0008)
├── e2e/                              # Playwright End-to-End multi-project test suites
│   ├── backend/                      # Server integration & API flow tests
│   ├── frontend/                     # UI interaction & visual journey tests
│   └── fixtures/                     # Test users, tokens, and mock payloads
├── piston-cli/                       # CLI tool for installing language packages into Piston
├── piston-entrypoint.sh              # Custom cgroup-safe dynamic entrypoint for rootless Podman
├── types/
│   └── piston.ts                     # Piston lifecycle management script (start/stop/setup/status)
├── server/                           # Backend NestJS 11 + Fastify Service
│   ├── prisma/
│   │   ├── schema.prisma             # MongoDB primary schema (Users, Topics, Questions)
│   │   └── schema.postgresql.prisma  # PostgreSQL secondary schema (Sessions, Answers)
│   ├── src/
│   │   ├── main.ts                   # Fastify bootstrap & global interceptor/pipe registration
│   │   ├── app.module.ts             # Root Composition Module wiring all features
│   │   ├── common/                   # Core shared leaf tokens, guards, pipes, schemas
│   │   │   ├── constants/
│   │   │   │   └── api.constants.ts  # ApiTags, ApiRoutes, ApiOperation, Error/Success messages
│   │   │   ├── decorators/           # @Public, @Roles, @CurrentUser
│   │   │   ├── filters/              # GlobalExceptionFilter (Global error transformer)
│   │   │   ├── guards/               # ClerkAuthGuard, RolesGuard
│   │   │   ├── interceptors/          # TransformInterceptor ({ success, message, data })
│   │   │   ├── middleware/           # SanitizeMiddleware, LoggerMiddleware
│   │   │   ├── pipes/                # ZodValidationPipe
│   │   │   ├── schemas/              # Swagger & Zod shared response schemas
│   │   │   ├── types/                # Shared TS type definitions
│   │   │   └── utils/                # Pure stateless helper functions & role limiters
│   │   ├── config/                   # Zod validated environment loaders & server options
│   │   ├── prisma/                   # ORM infrastructure services (PrismaService, PrismaPostgresqlService)
│   │   ├── mastra/                   # AI Agent Subsystem (providers.ts, agents/)
│   │   └── modules/                  # Vertical Domain Modules (health, user, topic, question, theory, tech-expert)
│   │       └── <module>/
│   │           ├── <module>.module.ts
│   │           ├── <module>.controller.ts
│   │           ├── <module>.service.ts
│   │           ├── <module>.controller.spec.ts
│   │           ├── <module>.service.spec.ts
│   │           └── dto/
│   │               ├── index.ts
│   │               ├── create-<name>.dto.ts
│   │               └── update-<name>.dto.ts
├── ui/                               # Frontend React 19 + Vite Web Application (N-Tier Layered)
│   ├── src/
│   │   ├── core/                     # Constants, route names, environment types (Leaf)
│   │   │   ├── env.ts
│   │   │   ├── routes.ts
│   │   │   ├── queryKeys.ts
│   │   │   └── index.ts
│   │   ├── utils/                    # Pure helper functions, zero React
│   │   │   ├── cn.ts
│   │   │   ├── formatDate.ts
│   │   │   └── index.ts
│   │   ├── data/                     # HTTP client, DTO types, query keys, RTK store
│   │   │   ├── apiClient.ts          # ky instance with Clerk Bearer token injection
│   │   │   ├── envelope.ts           # { success, message, data } API response types
│   │   │   ├── store/                # Redux Toolkit (Client UI State Only)
│   │   │   │   ├── index.ts
│   │   │   │   └── slices/
│   │   │   │       └── uiSlice.ts    # Sidebar toggles, wizard active steps, modal states
│   │   │   ├── user/                 # Domain Data (user.api.ts, user.types.ts, user.keys.ts)
│   │   │   └── topic/                # Domain Data (topic.api.ts, topic.types.ts, topic.keys.ts)
│   │   ├── service/                  # Third-party SDK Adapters
│   │   │   └── clerk/                # Clerk hooks re-exported with domain types (useCurrentUser.ts)
│   │   ├── logic/                    # Reader & Command Hooks (CQRS Logic)
│   │   │   ├── user/
│   │   │   │   ├── useUserReader.ts          # useQuery wrapper
│   │   │   │   ├── useUpdateSettingsCommand.ts # useMutation wrapper
│   │   │   │   └── index.ts
│   │   │   └── topic/
│   │   │       ├── useTopicsReader.ts
│   │   │       └── index.ts
│   │   ├── components/               # Pure Presentational Components (Zero data/logic imports)
│   │   │   ├── ui/                   # Shadcn UI primitives (Button.tsx, Input.tsx)
│   │   │   ├── common/               # Layout primitives (Navbar.tsx, Sidebar.tsx)
│   │   │   └── user/                 # Feature widgets (UserCard.tsx, UserCard.types.ts, styles.css)
│   │   ├── pages/                    # Route Views & Composition Roots
│   │   │   ├── DashboardPage.tsx     # Composes components + logic
│   │   │   ├── dashboard/            # Sub-components for dashboard (DashboardHeader.tsx, styles.css)
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── SignInPage.tsx
│   │   │   └── SignUpPage.tsx
│   │   ├── app/                      # App boot & Providers
│   │   │   ├── App.tsx               # Route declarations & Clerk gates
│   │   │   ├── providers.tsx         # ClerkProvider, QueryClientProvider, ReduxProvider
│   │   │   └── main.tsx              # Vite entry point
│   │   └── index.css                 # Tailwind CSS v4 design tokens
```

---

## 3. Layer Responsibilities & Boundary Matrix

| Layer                        | Location                                | Primary Responsibilities                                                                                                                              | Non-Responsibilities                                                                                                 | Allowed Dependencies                                    | Forbidden Dependencies                                   |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **Server Presentation**      | `server/src/modules/**/*.controller.ts` | • HTTP request routing<br>• Request DTO validation<br>• Swagger documentation<br>• Invoking application services                                      | • Direct database queries<br>• AI prompting / LLM calls<br>• Business rule enforcement<br>• Manual envelope building | Module Services, DTOs, `@/common`, NestJS decorators    | Prisma directly, External SDKs, other module controllers |
| **Server Application Logic** | `server/src/modules/**/*.service.ts`    | • Core business use cases<br>• Transaction management<br>• Orchestrating Prisma queries<br>• Invoking AI agents / Piston<br>• Pino structured logging | • Direct HTTP request/response handling<br>• Fastify raw request manipulation<br>• Formatting UI layouts             | Prisma services, `@/common`, Mastra agents, Redis Cache | Fastify Request/Response, UI code, Controller classes    |
| **Server AI Layer**          | `server/src/mastra/`                    | • LLM prompt engineering<br>• Model failover routing<br>• Zod structured output parsing<br>• Agent tools & memory                                     | • Database writes<br>• HTTP routing<br>• Auth verification                                                           | LLM SDKs, `@/common`, Zod                               | Server modules, Fastify context, Prisma                  |
| **Server Persistence**       | `server/src/prisma/`                    | • Prisma client lifecycle<br>• MongoDB / Postgres connections<br>• Database error translation<br>• Connection pooling                                 | • Business logic<br>• HTTP logic<br>• AI generation                                                                  | `@prisma/client`, Pino logger                           | Server modules, Mastra, UI                               |
| **Server Common (Leaf)**     | `server/src/common/`                    | • Global guards (`ClerkAuth`, `Roles`)<br>• Response interceptors<br>• Exception filters<br>• Shared constants & schemas                              | • Domain business rules<br>• Direct database calls<br>• Feature-specific DTOs                                        | NestJS core, Zod, Svix                                  | Any server module (`modules/*`)                          |
| **Frontend Core (Leaf)**     | `ui/src/core/`                          | • Route names, env types, query key constants                                                                                                         | • Runtime business logic<br>• React components                                                                       | Node types, TypeScript built-ins                        | Any other `ui/` layer                                    |
| **Frontend Utils (Leaf)**    | `ui/src/utils/`                         | • Pure helper functions (`cn()`, formatters)<br>• Zero React DOM                                                                                      | • Application state<br>• Business rules                                                                              | `core/`                                                 | Any layer above `utils/`                                 |
| **Frontend Data**            | `ui/src/data/`                          | • HTTP client (`apiClient.ts`)<br>• Per-resource API calls & types<br>• Client state (`data/store/`)                                                  | • Direct React rendering<br>• Calling hooks                                                                          | `core/`, `utils/`                                       | `service/`, `logic/`, `components/`, `pages/`            |
| **Frontend Service**         | `ui/src/service/`                       | • 3rd-party SDK adapters (Clerk, future Stripe/Cloudinary)                                                                                            | • Storing business state<br>• UI rendering                                                                           | `core/`, `utils/`                                       | `data/`, `logic/`, `components/`, `pages/`               |
| **Frontend Logic (CQRS)**    | `ui/src/logic/`                         | • **Reader hooks** (`useXxxReader` → `useQuery`)<br>• **Command hooks** (`useXxxCommand` → `useMutation`)                                             | • Direct React DOM rendering<br>• CSS styling                                                                        | `core/`, `utils/`, `data/`, `service/`                  | `components/`, `pages/`                                  |
| **Frontend Components**      | `ui/src/components/`                    | • Presentational UI primitives & widgets<br>• Receives data strictly via props                                                                        | • Direct network calls<br>• Importing `data/` or `logic/`                                                            | `core/`, `utils/`, `service/`                           | `data/`, `logic/`, `pages/`                              |
| **Frontend Pages (Shell)**   | `ui/src/pages/`                         | • Route components & composition roots<br>• Composes `components/` with `logic/` hooks                                                                | • Heavy business calculations (Delegate to logic hooks)                                                              | All frontend layers                                     | (Top of frontend hierarchy)                              |

---

## 4. Dependency Direction & Graph

### 4.1 Monorepo Dependency Hierarchy

```
                            ┌────────────────────────┐
                            │    Root / E2E Tests    │
                            │   (playwright.config)  │
                            └───────────┬────────────┘
                                        │ Tests both packages
                     ┌──────────────────┴──────────────────┐
                     ▼                                     ▼
        ┌─────────────────────────┐           ┌─────────────────────────┐
        │       ui/ Package       │           │     server/ Package     │
        │   (React 19 + Vite)     │           │    (NestJS + Fastify)   │
        └────────────┬────────────┘           └────────────┬────────────┘
                     │                                     │
                     │ HTTP JSON REST /api/v1              │
                     └──────────────────┬──────────────────┘
                                        ▼
                            ┌────────────────────────┐
                            │ Piston Sandbox Engine  │
                            │  (127.0.0.1:2000 HTTP) │
                            └────────────────────────┘
```

### 4.2 Frontend Internal Dependency Hierarchy (Strict Inward Flow)

```
                 ┌─────────────────────────────┐
                 │   pages/   (UI Shell)       │  ← Composition Root: Composes
                 │   (DashboardPage.tsx, etc.) │     components with logic hooks
                 └──────┬──────────┬───────────┘
                        │          │
               ┌────────▼──┐   ┌───▼──────────┐
               │ logic/    │   │ components/  │  ← Presentational only;
               │ (hooks)   │   │ (presenter)  │     NO data/logic imports
               └────┬──────┘   └───┬──────────┘
                    │              │
         ┌──────────┼──────────┐   │
         │          │          │   │
    ┌────▼───┐  ┌───▼────┐  ┌──▼───▼──┐
    │ data/  │  │service/│  │service/ │  ← Third-party SDK Adapters
    └────┬───┘  └───┬────┘  └───┬─────┘
         │          │           │
         └──────────┼───────────┘
                    │
               ┌────▼────┐
               │ utils/  │               ← Stateless helper functions
               └────┬────┘
                    │
               ┌────▼────┐
               │ core/   │               ← Pure leaf constants & types
               └─────────┘
```

---

## 5. Circular Dependency Prevention & Import Rules

1. **Leaf Directory Isolation (`server/src/common/`, `ui/src/core/`, `ui/src/utils/`):**
   - `server/src/common/` must NEVER import from `modules/`, `prisma/`, or `mastra/`.
   - `ui/src/core/` must import nothing from other `ui/` layers.
   - `ui/src/utils/` may import from `core/` only.
2. **The Frontend Seam Rule:**
   - `components/` must NEVER import from `data/` or `logic/`. It receives data exclusively via props from `pages/`.
   - `pages/` is the only layer allowed to import from both `components/` and `logic/`.
3. **Module Encapsulation (Server):**
   - A server module must NEVER deep-import another module's internal files.
   - Cross-module dependencies must be imported through NestJS module exports (`TopicModule` in `imports: [TopicModule]`) and injected via standard DI.
4. **ESM / NodeNext File Extension Rule (Server):**
   - Every relative import in `server/` MUST explicitly include the `.js` extension (e.g., `import { TopicService } from './topic.service.js'`).
   - Path aliases `@/*` mapping to `src/*` MUST also end in `.js` (e.g., `import { PrismaService } from '@/prisma/prisma.service.js'`).
5. **Component vs Type Isolation (`ui/`):**
   - All React component interfaces must live in a separate `*.types.ts` file and be imported via `import type { IProps } from './feature.types'`.
6. **Single Barrel Rule (`index.ts`):**
   - Every UI layer/feature folder and every backend `dto/` folder MUST expose a single `index.ts` barrel file exporting its public surface.

---

## 6. Backend Core Architecture Patterns

### 6.1 Dual-Database Strategy (Prisma ORM)

```
                      ┌─────────────────────────────────┐
                      │        NestJS Application       │
                      └────────┬───────────────┬────────┘
                               │               │
            ┌──────────────────┘               └──────────────────┐
            ▼                                                     ▼
┌───────────────────────┐                             ┌───────────────────────┐
│     PrismaService     │                             │PrismaPostgresqlService│
│   (MongoDB Primary)   │                             │ (PostgreSQL Secondary)│
├───────────────────────┤                             ├───────────────────────┤
│ • User / UserSettings │                             │ • Interview Sessions  │
│ • Topic / Category    │                             │ • Question Answers    │
│ • Question Bank       │                             │ • Async Job Queues    │
│ • Theory Content      │                             │ • Vector Embeddings   │
└───────────────────────┘                             └───────────────────────┘
```

#### Dual Client Rules:

1. `PrismaService` connects to MongoDB (`DATABASE_URL`) and is the primary dependency for user management, curriculum topics, and questions.
2. `PrismaPostgresqlService` connects to PostgreSQL (`POSTGRESQL_URL`). During `onModuleInit()`, it checks if `POSTGRESQL_URL` is set and whether the PostgreSQL client has been generated. If not, it logs a warning and gracefully operates in no-op mode without crashing the server.
3. Feature services must explicitly declare which store they target. Never assume a single database instance holds all relations.

---

### 6.2 Mastra AI Agent System & Multi-LLM Routing

```
┌────────────────────────────┐
│   Service Request          │
│   (e.g., TheoryService)    │
└─────────────┬──────────────┘
              │ Calls Agent with Prompt + Zod Schema
              ▼
┌────────────────────────────┐
│    Mastra Agent Runner     │
└─────────────┬──────────────┘
              │ Passes through Failover Router
              ▼
┌────────────────────────────────────────────────────────┐
│             Provider Failover Router                   │
│                                                        │
│   1. Primary:   NVIDIA NIM (meta/llama-3.3-70b/nemotron)│
│   2. Secondary: Groq (llama-3.3-70b-versatile)         │
│   3. Tertiary:  OpenAI (gpt-4o-mini)                   │
└─────────────┬──────────────────────────────────────────┘
              │ Validates Structured JSON
              ▼
┌────────────────────────────┐
│   Zod Schema Validation    │ ──> Guaranteed Typed Result to Service
└────────────────────────────┘
```

- **Deterministic Outputs:** All agent responses must be enforced via Zod structured output schemas.
- **Failover Security:** If the primary NVIDIA NIM endpoint experiences rate limiting or outages, `providers.ts` automatically falls back to secondary providers without interrupting user practice.

---

### 6.3 Piston Code Execution Engine Sandbox

```
┌────────────────────────┐
│  PrepAI Backend Server │
└───────────┬────────────┘
            │ POST /api/v2/execute
            │ { language: "python", version: "3.10.0", files: [...] }
            ▼
┌────────────────────────────────────────────────────────┐
│  Piston API Container (IPv4 127.0.0.1:2000)            │
│  - Rootless Podman Container                           │
│  - Custom Entrypoint (piston-entrypoint.sh)            │
│  - Dynamic cgroup v2 controller filtering              │
│  - Named Volume: piston_data -> /piston                │
└────────────────────────────────────────────────────────┘
```

#### Sandboxing Constraints:

- **Port Binding:** Piston is bound strictly to `127.0.0.1:2000` to avoid Windows/WSL2 port forwarding conflicts.
- **Persistent Runtimes:** Language packages are installed via `./piston-cli` into the persistent `piston_data` volume.
- **Lifecycle Control:** Root scripts `pnpm piston:start`, `pnpm piston:stop`, `pnpm piston:status`, and `pnpm piston:setup` govern container operations.

---

### 6.4 Authentication & Authorization Flow

```
[ Incoming HTTP Request ]
          │
          ▼
[ ClerkAuthGuard ]
          │ 1. Extracts Bearer JWT from Authorization Header
          │ 2. Verifies token with Clerk Node SDK
          │ 3. Queries MongoDB User via clerkUserId
          │ 4. Hydrates request.user = { id, email, role, clerkUserId }
          ▼
[ RolesGuard ]
          │ 1. Checks handler @Roles('ADMIN', 'USER') metadata
          │ 2. Compares against request.user.role
          │ 3. Throws 403 Forbidden if insufficient privileges
          ▼
[ Controller Handler Execution ]
```

- **Public Routes:** Decorated with `@Public()` to bypass `ClerkAuthGuard`.
- **User Sync Webhook:** `POST /api/v1/webhooks/clerk` verifies Svix signatures and synchronizes user lifecycle events (`user.created`, `user.updated`, `user.deleted`) to MongoDB.

---

## 7. Frontend Core Architecture Patterns

### 7.1 CQRS Reader / Command Pattern

The frontend encapsulates all data interactions inside dedicated hooks located in `ui/src/logic/<resource>/`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              REACT 19 UI                               │
└───────────────────┬────────────────────────────────▲───────────────────┘
                    │                                │
    1. Writes via   │                                │ 4. Reads via
       Command Hook │                                │    Reader Hook
                    ▼                                │
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│         COMMAND HOOKS (logic/)       │  │     READER HOOKS (logic/)    │
│  - useUpdateSettingsCommand()        │  │  - useUserReader()           │
│  - Wraps useMutation                 │  │  - useTopicsReader()         │
│  - Owns Query Key Invalidation       │  │  - Wraps useQuery            │
│  - Unwraps Envelope ({ data })       │  │  - Sets Stale-Time & Caching │
└───────────────────┬──────────────────┘  └──────────▲───────────────────┘
                    │                                │
                    │ 2. Mutates                     │ 3. Fetches
                    ▼                                │
┌────────────────────────────────────────────────────┴───────────────────┐
│                          DATA LAYER (data/)                            │
│  - apiClient.ts (ky instance + Clerk JWT injection)                    │
│  - <resource>/<resource>.api.ts (Pure API call functions)              │
│  - <resource>/<resource>.keys.ts (Query key factory)                   │
│  - store/ (Redux Toolkit for client-ephemeral state)                   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Reader Hook Example (`ui/src/logic/user/useUserReader.ts`):

```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/data/apiClient';
import { getMe } from '@/data/user/user.api';
import { userQueryKeys } from '@/data/user/user.keys';
import type { IUser } from '@/data/user/user.types';

export const useUserReader = (): UseQueryResult<IUser, Error> =>
  useQuery({
    queryKey: userQueryKeys.me(),
    queryFn: async () => {
      const response = await getMe(apiClient);
      return response.data;
    },
  });
```

#### Command Hook Example (`ui/src/logic/user/useUpdateSettingsCommand.ts`):

```ts
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '@/data/apiClient';
import { updateSettings } from '@/data/user/user.api';
import { userQueryKeys } from '@/data/user/user.keys';
import type { IUpdateSettingsBody } from '@/data/user/user.types';

export const useUpdateSettingsCommand = (): UseMutationResult<void, Error, IUpdateSettingsBody> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IUpdateSettingsBody) => updateSettings(apiClient, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
    },
  });
};
```

#### Micro-Feature Folding Rule:

- **Default:** Features split into `*.api.ts`, `*.types.ts`, `*.keys.ts`, and `index.ts`.
- **Micro-Features:** For simple features with ≤ 1 read query and 0 mutations (e.g., `health`), types and keys may be folded directly into `health.api.ts`. The moment a mutation or command is added, it must split.

---

## 8. End-to-End Data Flow Scenarios

### Scenario 1: User Practice Session & Answer Evaluation

```
[ User in UI ]
      │ Types answer / submits voice transcript
      ▼
[ useSubmitAnswerCommand() ] (ui/src/logic/theory/)
      │ Calls apiClient with Clerk Bearer Token
      ▼
[ POST /api/v1/theory/evaluate ]
      │
      ▼
[ ClerkAuthGuard + RolesGuard ] ──> Validates Token & Injects request.user
      │
      ▼
[ TheoryController.evaluateAnswer(dto) ]
      │
      ▼
[ TheoryService.evaluateAnswer() ]
      │ 1. Fetches Question rubric from MongoDB (PrismaService)
      │ 2. Dispatches to Mastra EvaluatorAgent (providers.ts)
      │ 3. NVIDIA NIM scores answer against rubric & generates feedback
      │ 4. Zod enforces evaluation schema (score: 0-100, strengths, weaknesses)
      │ 5. Records Answer & Session event in PostgreSQL (PrismaPostgresqlService)
      │ 6. Logs structured info via Pino
      ▼
[ TransformInterceptor ] ──> Wraps result into { success: true, message: "...", data: evaluation }
      │
      ▼
[ Command hook onSuccess invalidates session reader -> UI renders score badge & feedback ]
```

---

### Scenario 2: Coding Challenge Execution Flow

```
[ Monaco Code Editor in UI ]
      │ User clicks "Run Code"
      ▼
[ useExecuteCodeCommand() ] (ui/src/logic/code/)
      │ POST /api/v1/code/execute { language: "typescript", code: "..." }
      ▼
[ CodeExecutionController -> CodeExecutionService ]
      │
      ▼
[ Piston Execution Client (127.0.0.1:2000) ]
      │ Sends sandboxed execution payload to Piston API
      ▼
[ Piston Sandboxed Container (piston_api) ]
      │ Executes code in isolated rootless environment with resource limits
      ▼
[ Standard Output / Runtime Errors Captured ]
      │
      ▼
[ CodeExecutionService evaluates test case assertions ]
      │
      ▼
[ Response returned to UI -> Terminal output & test case visual indicators update ]
```

---

## 9. Standardized Communication & Error Handling

### 9.1 Global Response Envelope

All backend endpoints return the uniform response envelope enforced by `TransformInterceptor`:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
```

- Controllers return plain objects: `{ message: TOPIC_CREATED_SUCCESS, data: topic }`.
- The interceptor automatically wraps the response into the standardized structure.

### 9.2 Global Exception Filter (`GlobalExceptionFilter`)

Uncaught exceptions are transformed into consistent error responses:

```json
{
  "success": false,
  "statusCode": 409,
  "message": "Topic with this name or slug already exists",
  "error": "Conflict",
  "timestamp": "2026-08-30T13:00:00.000Z",
  "path": "/api/v1/topic"
}
```

- **Pino Context Logging:** Every error is logged with request method, URL, and stack trace before being dispatched to the client.

---

## 10. Testing Architecture & Verification Gate

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: LOCAL BUILD GATE                        │
│  - TypeScript compilation: pnpm build (server & ui)                    │
│  - Lint & Format: pnpm lint && pnpm format                             │
│  - Unit & Integration Specs: pnpm test (Vitest)                        │
│  - Coverage Threshold: 90% lines/statements/functions/branches (server)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Must pass 100%
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     TIER 2: PLAYWRIGHT E2E GATE                        │
│  - Backend API journey specs: pnpm test:backend                        │
│  - Frontend UI flow specs: pnpm test:frontend                          │
│  - Full Chromium E2E: pnpm test:chromium                               │
└────────────────────────────────────────────────────────────────────────┘
```

- **Headless Hook Testing:** Reader and Command hooks are tested in isolation by mocking `apiClient` without mounting React DOM or Clerk providers.
- **Vitest Mocking Strategy:** Server specs mock `PrismaService`, `PrismaPostgresqlService`, and Mastra agents via `vi.fn()` to execute in under 5 seconds.

---

## 11. Naming Conventions & Code Standards

| Artifact                    | Convention                                            | Example                                                          |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| **TypeScript Interface**    | PascalCase prefixed with `I`                          | `ITopicCardProps`, `IUserSession`, `IApiResponse<T>`             |
| **TypeScript Type / Enum**  | PascalCase without `I`                                | `UserRole`, `QuestionCategory`, `DifficultyLevel`                |
| **React Component Files**   | PascalCase ending in `.tsx`                           | `DashboardPage.tsx`, `UserCard.tsx`, `Button.tsx`                |
| **Hook & Utility Files**    | camelCase ending in `.ts`                             | `useUserReader.ts`, `useUpdateSettingsCommand.ts`, `cn.ts`       |
| **Type Files**              | `<Name>.types.ts` or `types.ts`                       | `UserCard.types.ts`, `user.types.ts`                             |
| **Reader Hook**             | camelCase prefixed with `use` and ending in `Reader`  | `useUserReader`, `useTopicsReader`                               |
| **Command Hook**            | camelCase prefixed with `use` and ending in `Command` | `useUpdateSettingsCommand`, `useSubmitAnswerCommand`             |
| **Redux Slice**             | camelCase ending in `Slice`                           | `uiSlice.ts`, `interviewUiSlice.ts`                              |
| **NestJS Backend Files**    | `kebab-case.ts`                                       | `topic.service.ts`, `topic.controller.ts`, `create-topic.dto.ts` |
| **NestJS Controller Class** | PascalCase ending in `Controller`                     | `TopicController`, `TheoryController`                            |
| **NestJS Service Class**    | PascalCase ending in `Service`                        | `TopicService`, `TheoryService`                                  |
| **NestJS Module Class**     | PascalCase ending in `Module`                         | `TopicModule`, `AppModule`                                       |
| **DTO Class**               | PascalCase ending in `Dto`                            | `CreateTopicDto`, `UpdateQuestionDto`                            |
| **API Route Constants**     | UPPER_SNAKE_CASE in `api.constants.ts`                | `CREATE_TOPIC_SUCCESS`, `TOPIC_NOT_FOUND`                        |

---

## 12. Architectural Anti-Patterns ("What Should NEVER Happen")

1. **Components Importing Data or Logic:** UI components must never import `data/` or `logic/`. They must receive data via props from `pages/`.
2. **Direct `fetch` / `ky` / `useQuery` in Pages:** Pages must never invoke `ky` or `useQuery` directly. All remote reads must use `useXxxReader()` and writes must use `useXxxCommand()`.
3. **Inline Interfaces in `.tsx` Files:** Never declare `interface Props { ... }` inside a component file. Interfaces must live in a co-located `*.types.ts` file.
4. **Omitting `.js` Extensions in Server Imports:** Never omit `.js` in relative or `@/*` server imports. The NodeNext/ESM build will fail at runtime.
5. **Cross-Module Deep Imports in Backend:** Never import internal files of another NestJS module directly. Always import the module and use dependency injection.
6. **Direct Prisma Calls in Controllers:** Controllers must NEVER call `this.prisma.x.findMany()`. All data access must be encapsulated inside a Service.
7. **Hardcoding Strings & Error Messages:** Never inline raw string literals for route paths, success messages, or error constants. Always reference `api.constants.ts`.
8. **Unsafe PostgreSQL Calls without Null Checks:** Never query PostgreSQL directly without accounting for the graceful degradation state of `PrismaPostgresqlService`.

---

## 13. Step-by-Step Feature Playbooks

### Playbook A: Adding a New Backend Module (e.g., `mock-interview`)

1. **Update API Constants (`server/src/common/constants/api.constants.ts`):**
   - Add module to `ApiTags` enum (`MOCK_INTERVIEW = 'Mock Interview'`).
   - Add routes to `ApiRoutes` enum (`MOCK_INTERVIEW = 'mock-interview'`).
   - Add success/error message constants (`CREATE_INTERVIEW_SUCCESS`, etc.).
2. **Define DTOs (`server/src/modules/mock-interview/dto/`):**
   - Create `create-mock-interview.dto.ts` with `class-validator` decorators.
   - Create `index.ts` barrel file.
3. **Implement Service (`server/src/modules/mock-interview/mock-interview.service.ts`):**
   - Inject `PrismaService` and `@InjectPinoLogger(MockInterviewService.name)`.
   - Implement business logic and error handling with standard NestJS exceptions (`NotFoundException`, `ConflictException`).
4. **Implement Controller (`server/src/modules/mock-interview/mock-interview.controller.ts`):**
   - Decorate with `@ApiTags()`, `@Controller()`, `@UseGuards(ClerkAuthGuard, RolesGuard)`.
   - Add Swagger annotations (`@ApiOperation()`, `@ApiResponse()`).
5. **Create Module (`server/src/modules/mock-interview/mock-interview.module.ts`):**
   - Declare `controllers: [MockInterviewController]`, `providers: [MockInterviewService]`, `exports: [MockInterviewService]`.
6. **Register in Root Module (`server/src/app.module.ts`):**
   - Add `MockInterviewModule` to `imports` array.
7. **Write Unit Tests:**
   - Create `mock-interview.service.spec.ts` (mock Prisma) and `mock-interview.controller.spec.ts` (mock Service). Run `pnpm test`.

---

### Playbook B: Adding a New Frontend Feature (e.g., `practice`)

1. **Define Data Layer (`ui/src/data/practice/`):**
   - Create `practice.types.ts` (`IPracticeSession`, `IQuestion`).
   - Create `practice.keys.ts` (`practiceQueryKeys.session(id)`).
   - Create `practice.api.ts` (calls `apiClient.get('practice/...')`).
   - Create `index.ts` barrel.
2. **Define Logic Layer (`ui/src/logic/practice/`):**
   - Create `usePracticeReader.ts` wrapping `useQuery`.
   - Create `useSubmitAnswerCommand.ts` wrapping `useMutation` with query invalidation.
   - Create `index.ts` barrel.
3. **Build Presentational Components (`ui/src/components/practice/`):**
   - Create `PracticeCard.tsx`, `PracticeCard.types.ts`, and `styles.css`.
   - Pure props only; zero imports from `data/` or `logic/`.
4. **Assemble Page View (`ui/src/pages/PracticePage.tsx`):**
   - Import `usePracticeReader` and `useSubmitAnswerCommand` from `@/logic/practice`.
   - Pass state and callbacks down to `PracticeCard`.
5. **Register Route in App (`ui/src/app/App.tsx`):**
   - Wrap with `ProtectedRoute` / `SignedIn` gate.

---

## 14. AI Implementation Constitution (Binding Rules for AI Assistants)

> **Mandatory Instructions for All AI Agents Working in this Repository:**
>
> 1. **Never Violate Layer Boundaries:** Respect the strict unidirectional flow. UI components never import `data/` or `logic/`; Controllers never execute raw SQL/Mongo queries; Common never imports from modules.
> 2. **Always Use NodeNext `.js` Imports on Server:** Every server-side relative import and `@/` import MUST end with `.js`.
> 3. **Follow UI File & Component Naming:** Component files use `PascalCase.tsx` (`DashboardPage.tsx`, `UserCard.tsx`), hooks/utils use `camelCase.ts` (`useUserReader.ts`, `cn.ts`). Interfaces use `I` prefix and live in `<name>.types.ts`.
> 4. **Use Reader & Command Hooks:** All frontend data reads must use `useXxxReader()` and writes must use `useXxxCommand()` in `ui/src/logic/`. Never call `useQuery`/`useMutation` directly inside pages or components.
> 5. **Always Use `api.constants.ts`:** Never hardcode route paths, API tags, or user-facing response strings in backend controllers or services.
> 6. **Dual Database Awareness:** Check whether data belongs in MongoDB (curriculum, questions, profiles) or PostgreSQL (sessions, answers, analytics).
> 7. **Always Verify with Tier 1 Gate:** Run format, lint, typecheck, and unit tests before completing any task. Maintain the 90% backend coverage threshold.

---

> 📖 **Companion Frontend Blueprint & ADR:**
>
> - Detailed Migration Plan: [frontend-refactor.md](frontend-refactor.md)
> - Architectural Decision Record: [ADR 0008: Frontend N-Tier Architecture](../adr/0008-frontend-n-tier.md)
