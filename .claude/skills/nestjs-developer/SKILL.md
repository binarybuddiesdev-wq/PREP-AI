---
name: nestjs-developer
description: Use when working on any backend code in the PrepAI NestJS server — creating modules, endpoints, services, guards, interceptors, middleware, pipes, decorators, schemas, Prisma models, env config, or tests. Triggers on any work inside server/src/. Also use when reviewing or refactoring backend code, debugging request flow, or wiring a new module into the AppModule.
---

# NestJS Developer

> If you are doing backend work on the PrepAI `server/` package, this is your
> playbook. It encodes the conventions of this codebase, the project-specific
> decisions in the ADRs, and the patterns every module follows.
>
> For the narrow task of "write a new API endpoint," see the `api-design`
> skill — this one is the broader backend-developer guide.

## When to use this skill

Use this skill whenever you are:

- Creating or modifying any module under `server/src/modules/<name>/`
- Adding a new endpoint (controller + service + DTO + schema) → use `api-design`
- Adding a guard, interceptor, pipe, middleware, or decorator
- Adding or modifying a Prisma model, schema, or migration
- Wiring env vars, config, or app bootstrap
- Adding a Mastra AI agent
- Adding a worker (BullMQ) or async job
- Reviewing or refactoring any of the above
- Debugging a request that flows: middleware → guards → interceptor → controller → service

If the work is purely frontend, infrastructure, or non-server, this skill
does not apply.

## The PrepAI backend at a glance

- **Framework:** NestJS 11 with **Fastify** adapter (NOT Express)
- **Module system:** ESM / NodeNext — every relative import MUST end with `.js`
  (even for `.ts` files). Path alias `@/*` → `src/*`
- **Validation:** `class-validator` (DTOs) and `ZodValidationPipe` (used in some
  modules)
- **Auth:** `ClerkAuthGuard` + `RolesGuard` applied together at controller
  level. `@Public()` opts out, `@Roles('ADMIN')` for admin-only
- **Logging:** `nestjs-pino` via `@InjectPinoLogger(X.name)`. Never
  `console.log` in services; `Logger` is fine in global infra (filters,
  guards)
- **API docs:** Swagger at `http://localhost:3000/docs`
- **Caching:** global `CacheModule` backed by Redis
- **ORM:** Prisma with two clients:
  - `PrismaService` (Mongo) for users, topics, questions
  - `PrismaPostgresqlService` (Postgres) for sessions, answers, jobs,
    audit log, vectors. **No-ops gracefully** if `POSTGRESQL_URL` is unset.
- **AI:** Mastra agents in `server/src/mastra/agents/`, provider router in
  `server/src/mastra/providers.ts`
- **API base path:** all routes live under `/api/v1/<module>`

## The file structure

```
server/src/
├── main.ts                            # bootstrap
├── app.module.ts                      # root module, wires everything
├── modules/
│   └── <name>/
│       ├── <name>.module.ts           # @Module({ providers, controllers })
│       ├── <name>.controller.ts       # HTTP layer
│       ├── <name>.service.ts          # business logic + DB
│       ├── <name>.controller.spec.ts  # controller tests (mock service)
│       ├── <name>.service.spec.ts     # service tests (mock Prisma)
│       └── dto/
│           ├── index.ts               # barrel: export * from each
│           ├── create-<name>.dto.ts
│           ├── update-<name>.dto.ts
│           └── get-<name>.dto.ts
├── common/
│   ├── constants/api.constants.ts     # all messages, ApiTags, ApiRoutes
│   ├── schemas/<name>/<name>.response.schema.ts  # Swagger response shapes
│   ├── guards/                       # ClerkAuthGuard, RolesGuard
│   ├── interceptors/                 # TransformInterceptor
│   ├── filters/                      # HttpExceptionFilter (global)
│   ├── middleware/                   # SanitizeMiddleware, LoggerMiddleware
│   ├── pipes/                       # ZodValidationPipe
│   ├── decorators/                  # @Public, @Roles, @CurrentUser
│   ├── utils/                       # role-limits, helpers
│   └── types/                        # shared TS types
├── config/                            # env validation, app/swagger/logger config
├── prisma/                           # PrismaService, PrismaPostgresqlService
└── mastra/                           # AI agents, providers
```

## The non-negotiable rules

These are not guidelines. Code that violates them is wrong.

### 1. ESM / NodeNext imports — every relative import has `.js`

```ts
// CORRECT
import { TopicService } from './topic.service.js';
import { ApiTags } from '@/common/index.js';

// WRONG
import { TopicService } from './topic.service';
import { TopicService } from './topic.service.ts';
import { ApiTags } from '@/common';
```

Path alias imports starting with `@/` SHOULD also include the `.js` extension
(e.g., `import { ApiTags } from '@/common/index.js'`) for full ESM/NodeNext
compatibility across bundlers and node runtimes. Same for relative imports
and DTO barrels — `import { CreateXxxDto } from './dto/index.js'`, never
just `'./dto'`.

### 2. Fastify, not Express

We run on `@nestjs/platform-fastify`. If you reach for anything from
`express`, stop.

- For raw request access, import `FastifyRequest` / `FastifyReply` from
  `'fastify'`, never `Request` from `'express'`.
- The global exception filter, guards, and middleware are typed against
  Fastify. Use the Fastify types throughout.
- `app.getHttpAdapter().getInstance()` returns a Fastify instance, not
  Express.

### 3. Never `console.log` in services — use `@InjectPinoLogger`

```ts
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class TopicService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(TopicService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createTopic(dto: CreateTopicDto) {
    this.logger.info({ name: dto.name }, 'topic created');
    return this.prisma.topic.create({ data: dto });
  }
}
```

The `Logger` from `@nestjs/common` is acceptable in global infrastructure
(guards, filters, middleware) but never in services or controllers.

### 4. Throw NestJS exceptions, not raw `Error`

```ts
// CORRECT
throw new NotFoundException(TOPIC_NOT_FOUND);
throw new ConflictException(TOPIC_ALREADY_EXISTS);
throw new BadRequestException(CANNOT_DELETE_TOPIC_WITH_QUESTIONS);

// WRONG
throw new Error('Topic not found');
```

The global `HttpExceptionFilter` reads `HttpException` subclasses and
formats the response correctly. Raw `Error` becomes a 500 with a generic
message.

### 5. The response envelope is fixed — never construct it

Every successful controller method returns `{ message, data }`:

```ts
return { message: CREATE_TOPIC_SUCCESS, data };
```

The global `TransformInterceptor` wraps this in
`{ success: true, message, data }`. You never construct the envelope
yourself in the controller.

### 6. DTOs use `class-validator`, not Zod (mostly)

For request/response shapes, use `class-validator` decorators:

```ts
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateTopicDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['practice', 'coding'])
  category!: string;
}
```

`ZodValidationPipe` is used in a few specific modules (typically when
schemas need to be reused client-side). The default is class-validator.

### 7. Use `PrismaService` (Mongo) or `PrismaPostgresqlService` — never raw PrismaClient

Inject the appropriate service, never instantiate `new PrismaClient()` in
your own code. The two services in `prisma/prisma.service.ts` are the
single point of access.

- **Mongo** (`PrismaService`): users, topics, questions, pdf metadata
- **Postgres** (`PrismaPostgresqlService`): sessions, answers, payments,
  jobs, idempotency keys, audit log, vectors. The Postgres client **no-ops
  gracefully** if `POSTGRESQL_URL` is unset — code that calls it must
  check for `undefined` (use `?.`)

Which database for what: see ADR-0001.

### 8. Never `process.env.X` directly — go through `ConfigService`

```ts
// CORRECT
constructor(private readonly config: ConfigService) {
  const key = this.config.get<string>('CLERK_SECRET_KEY');
}

// WRONG
const key = process.env.CLERK_SECRET_KEY;
```

The env schema in `server/src/config/env.validation.ts` validates and
types every env var at boot. Reading `process.env` directly bypasses this
and breaks the single source of truth.

### 9. Add new constants to `api.constants.ts`, never hardcode strings

```ts
// CORRECT
throw new NotFoundException(TOPIC_NOT_FOUND);
// where TOPIC_NOT_FOUND is imported from '@/common/index.js'

// WRONG
throw new NotFoundException('Topic not found');
```

All success messages, error messages, `ApiTags`, `ApiRoutes`, and
`ApiOperation` enum values live in `server/src/common/constants/api.constants.ts`.
Add new ones there; never inline string literals in controllers or
services.

### 10. Spec tests for every controller and service

```ts
// topic.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TopicController } from './topic.controller.js';
import { TopicService } from './topic.service.js';

describe('TopicController', () => {
  let controller: TopicController;
  let service: TopicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TopicController],
      providers: [
        { provide: TopicService, useValue: { createTopic: vi.fn(), ... } },
      ],
    }).compile();

    controller = module.get(TopicController);
    service = module.get(TopicService);
  });

  it('returns the success envelope on create', async () => {
    vi.mocked(service.createTopic).mockResolvedValue({ id: '1', name: 'React' });
    const result = await controller.createTopic({ name: 'React', category: 'practice', slug: 'react' });
    expect(result).toEqual({ message: expect.any(String), data: { id: '1', name: 'React' } });
  });
});
```

Controller specs mock the service. Service specs mock Prisma with
`vi.fn()`. See `topic.controller.spec.ts` and `topic.service.spec.ts` for
the canonical pattern.

### 11. Register the module in `app.module.ts`

Every new module goes into the `imports` array of `AppModule`. The order
doesn't matter functionally, but follow the existing order (config first,
Prisma, then feature modules alphabetically).

### 12. Never modify the global `TransformInterceptor` or `HttpExceptionFilter`

The envelope shape (`{ success, message, data }`) and the error shape
(`{ success: false, message, statusCode, path, timestamp }`) are fixed. If
a new endpoint needs a different shape, the answer is to fix the endpoint,
not the global filter.

## The response flow — what happens to a request

Knowing this helps when debugging:

```
HTTP request
  ↓
Fastify (body parsing, CORS, helmet)
  ↓
SanitizeMiddleware (global)         — strips dangerous keys
  ↓
ClerkAuthGuard                      — verifies Bearer token, attaches request.user
  ↓
RolesGuard                          — checks @Roles metadata
  ↓
[ZodValidationPipe if configured]   — runs Zod schema
  ↓
Controller handler                  — calls service, returns { message, data }
  ↓
TransformInterceptor (global)       — wraps in { success, message, data }
  ↓
HTTP response

If exception thrown anywhere:
  ↓
HttpExceptionFilter (global)        — formats { success: false, message, statusCode, path, timestamp }
```

If you need to add a step (rate limit, request id, audit log), the
question is: **which step of the flow does it belong in?** Most cross-cutting
concerns are middleware, guards, or interceptors — not controller code.

## Project-specific decisions (encoded as ADRs)

Read these once. They explain the *why* behind the rules above.

- **ADR-0001 — Polyglot persistence (Mongo + Postgres).** Which DB for
  which model. Never mix.
- **ADR-0002 — Clerk webhook for user provisioning.** Users are created
  via the Svix-verified `POST /webhooks/clerk` endpoint, not by lazy
  create. See `modules/user/webhook.controller.ts`.
- **ADR-0003 — pgvector for RAG.** Vector store is Postgres, not Pinecone
  or Qdrant.
- **ADR-0004 — BullMQ for async jobs.** The queue runs in the same Node
  process in dev, separate in prod. Concurrency per queue is configured
  in the queue name.
- **ADR-0005 — Redis INCR for daily quotas.** Atomic increment on first
  hit, Postgres is system of record. Quota logic lives in the service,
  not the controller.
- **ADR-0006 — Defer Firecracker.** v1 uses Docker. Network isolation,
  resource limits, and worker pool size are the v1 mitigations.
- **ADR-0007 — Groq as LLM fallback.** NVIDIA primary, Groq fallback.
  Switch via `LLM_PROVIDER` env var.

## The reference module

`server/src/modules/topic/` is the canonical reference for how every
CRUD module should look. When in doubt, mirror it:

- `topic.module.ts` — 9 lines, just providers + controllers
- `topic.controller.ts` — full Swagger decorators, `@UseGuards`,
  `@Roles('ADMIN')` on create/update/delete
- `topic.service.ts` — constructor with PrismaService + PinoLogger,
  exception types thrown on business rule violations
- `dto/index.ts` — barrel
- `topic.controller.spec.ts` + `topic.service.spec.ts` — testing
  pattern

## Adding a new module — the procedure

1. **Read the spec** at `routes/<name>-api-spec.md`. If it doesn't exist,
   ask the user to write it or write it together. Don't code without a
   spec.
2. **Read `topic/`** end-to-end as the reference.
3. **Create the DTOs** in `modules/<name>/dto/`. Use `class-validator`
   decorators + `@ApiProperty` / `@ApiPropertyOptional` for Swagger.
4. **Create the barrel** at `modules/<name>/dto/index.ts`.
5. **Create the service** with `@Injectable()`. Inject `PrismaService` or
   `PrismaPostgresqlService` (per ADR-0001). Inject `PinoLogger` via
   `@InjectPinoLogger(<Service>.name)`.
6. **Create the controller** with full Swagger decorators. See
   `api-design` skill for endpoint-level rules.
7. **Create response schemas** in `server/src/common/schemas/<name>/`.
8. **Add constants** (ApiTags, ApiRoutes, ApiOperation, success/error
   messages) to `api.constants.ts`.
9. **Create the module** at `modules/<name>/<name>.module.ts`.
10. **Register** in `app.module.ts` imports.
11. **Write spec tests** for both controller and service.
12. **Update the route spec** at `routes/<name>-api-spec.md` to match the
    code.

## Adding a guard, interceptor, pipe, middleware, or decorator

These are global infra. The procedure:

1. Create the file under `server/src/common/<type>/`.
2. Export it from `server/src/common/<type>/index.ts`.
3. If global (applies to every request), register in `app.module.ts` via
   `configure(consumer)` (middleware) or `APP_GUARD` / `APP_INTERCEPTOR` /
   `APP_PIPE` / `APP_FILTER` providers.
4. If per-route, the consumer applies it with `.forRoutes(...)` or you
   attach via decorator (`@UseGuards(...)`).

**Reference implementations:**

- Guard: `server/src/common/guards/clerk-auth.guard.ts`
- Interceptor: `server/src/common/interceptors/transform.interceptor.ts`
- Filter: `server/src/common/filters/http-exception.filter.ts`
- Middleware: `server/src/common/middleware/sanitize.middleware.ts`
- Pipe: `server/src/common/pipes/zod-validation.pipe.ts`
- Decorator: `server/src/common/decorators/roles.decorator.ts`

## Adding a Prisma model

1. Edit the relevant schema:
   - Mongo: `server/prisma/schema.prisma`
   - Postgres: `server/prisma/schema.postgresql.prisma`
2. Run `pnpm prisma:push:mongodb` (or `:postgresql`) to push the schema.
3. Run `pnpm prisma:generate` to regenerate the client. The Postgres
   client writes to `server/src/generated/postgresql-client/`.
4. If a new env var is needed, add to `env.validation.ts`.
5. Update ADR-0001 if the model lives in a non-obvious DB.

## When something is broken

| Symptom | First place to look |
|---|---|
| 401 Unauthorized | `ClerkAuthGuard` — token format, CLERK_SECRET_KEY, webhook fired? |
| 403 Forbidden | `RolesGuard` — `@Roles('ADMIN')` mismatch, or Clerk webhook hasn't fired so `user.role` is undefined |
| 404 Not Found | Service threw `NotFoundException` — query by id, was the row created? |
| 409 Conflict | Service threw `ConflictException` — duplicate check failing or wrong |
| 422 Validation | DTO decorator mismatch — class-validator stripped the field? |
| 500 Internal | Stack trace in `logs/`. Common causes: Prisma not generated, env var unset, Postgres client not generated yet |
| Endpoint not found | Module not registered in `app.module.ts` |
| Env validation error at boot | `env.validation.ts` rejected an env var — usually a typo or missing required var |
| Postgres "Database not available" | `POSTGRESQL_URL` unset OR client not generated yet. The service no-ops gracefully; check the warn log at boot. |

## Testing patterns

- **Unit tests:** `*.spec.ts` next to the file. `vi.fn()` for mocks.
- **E2E tests:** `server/test/e2e/**/*.e2e-spec.ts`. Real HTTP calls
  against a running server.
- **Run unit tests:** `pnpm test` (from `server/`)
- **Run E2E tests:** `pnpm test:e2e`
- **Coverage threshold:** 90% on lines/statements/functions/branches

For a new module, write at minimum:
- `controller.spec.ts` — every handler, success + error path
- `service.spec.ts` — every public method, success + every thrown
  exception

## Conventions this project does NOT follow (intentionally)

Some patterns you'll see in NestJS tutorials but NOT here:

- **Default exports.** Everything is named-exported. No `export default`.
- **Express anywhere.** Fastify only.
- **Raw `process.env` access.** ConfigService only.
- **Mongoose / TypeORM / MikroORM.** Prisma only.
- **Jest.** Vitest. Same API, different runner.
- **`.spec.ts` files outside `src/`.** Tests live next to the code they
  test. E2E tests are the exception — they live in `test/e2e/`.
- **Inline Swagger response shapes in the controller.** Response
  schemas are in `common/schemas/<name>/`, imported by the controller.

## When in doubt

Read `topic/` end-to-end. If your new code looks different, you're
probably wrong. If the existing code does something the rules above
don't cover, the existing code is the source of truth — update the
rules if they're wrong, don't fight them.
