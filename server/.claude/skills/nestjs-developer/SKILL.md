---
name: nestjs-developer
description: Use when creating, modifying, reviewing or debugging any backend code under server/src in the PrepAI NestJS + Fastify server — modules, controllers, services, guards, interceptors, pipes, middleware, decorators, config and bootstrap, or wiring a module into AppModule. Backend only; ui/ uses react-developer.
---

# NestJS Developer

The framework-level rules for `server/src/`. It sits on top of the `server-developer` skill and hands specialised work to its siblings:

| Work                                                       | Skill              |
| ---------------------------------------------------------- | ------------------ |
| An endpoint, DTO, status code, message or response shape   | `api-design`       |
| A Prisma query, user-scoped data, the Mongo/Postgres split | `prisma-database`  |
| A schema, index, backfill or seed change                   | `db-schema-change` |
| `server/src/mastra/` or an LLM call                        | `mastra-ai`        |
| A `*.spec.ts`                                              | `testing`          |

Not for `ui/`: that is `react-developer`.

## The backend at a glance

- **Framework:** NestJS 11 on **Fastify** (never Express). Routes live under `/api/v1/<module>`; Swagger at `http://localhost:3000/docs`.
- **Modules:** ESM / NodeNext. Every relative import ends in `.js`. Path alias `@/*` → `src/*`.
- **Auth:** `ClerkAuthGuard` + `RolesGuard` together at controller level; `@Public()` opts out, `@Roles('ADMIN')` restricts.
- **Validation:** `class-validator` DTOs by default; `ZodValidationPipe` where a Zod schema is reused (the Mastra endpoints).
- **Logging:** `nestjs-pino`, `@InjectPinoLogger(X.name)`.
- **Data:** Prisma, two clients — `PrismaService` (Mongo) and `PrismaPostgresqlService` (Postgres, no-ops if `POSTGRESQL_URL` is unset).
- **Cache:** global `CacheModule` on Redis. **AI:** Mastra agents.

## Non-negotiable rules

One line each. The full rule, with a correct and a wrong example, is in [`references/rules.md`](references/rules.md). Code that breaks one is wrong.

1. **`.js` on every relative and `@/` import**, including barrels (`./dto/index.js`, `@/common/index.js`).
2. **Fastify, not Express.** Raw access uses `FastifyRequest` / `FastifyReply` from `'fastify'`.
3. **No `console.*` in services or controllers.** Use `@InjectPinoLogger(X.name)`. Nest's `Logger` is acceptable only in global infrastructure.
4. **Throw Nest `HttpException` subclasses**, never a raw `Error` (a raw error is a generic 500).
5. **A handler returns `{ message, data }`.** The global `TransformInterceptor` builds the envelope; you never do.
6. **DTOs are `class-validator` classes** unless a Zod schema is genuinely shared.
7. **Inject the Prisma services**; never `new PrismaClient()`.
8. **Configuration through `ConfigService`** in anything you add. The accepted `process.env` exceptions (module-load-time code) are listed in the full rule.
9. **Messages, tags, routes and operation names come from `common/constants/api.constants.ts`**; no inline string literals.
10. **A controller spec and a service spec for every module** (`testing`).
11. **Register every module in `app.module.ts`.**
12. **Never change the global `TransformInterceptor` or `GlobalExceptionFilter`** to fit one endpoint. Fix the endpoint.

## Layer boundaries

| Directory                    | May import from                                                                                                      | Must not import                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `server/src/modules/<name>/` | `common/`, `@/common`, `@prisma/client`, other modules **only through their Nest module** (`imports: [OtherModule]`) | another module's internals                                  |
| `server/src/common/`         | nothing from `modules/`                                                                                              | modules                                                     |
| `server/src/config/`         | `@/common`                                                                                                           | modules                                                     |
| `server/src/prisma/`         | nothing                                                                                                              | modules                                                     |
| `server/src/mastra/`         | `@/common`                                                                                                           | modules (agents are reached through the `mastra` singleton) |

The root `eslint.config.js` declares a `no-restricted-imports` rule against deep imports into another module's internals; do not rely on it alone. A controller reaching Prisma directly, or business logic in a controller, passes lint and is still a violation.

## Naming

Suffix every NestJS artefact with its role, in PascalCase: `TopicController`, `TopicService`, `TopicModule`, `ClerkAuthGuard`, `TransformInterceptor`, `ZodValidationPipe`, `SanitizeMiddleware`; DTOs end in `Dto` (`CreateTopicDto`); decorators are applied as `@Public()`, `@Roles()`, `@CurrentUser()`. Files are kebab-case with the role: `topic.service.ts`, `create-topic.dto.ts`, `topic.controller.spec.ts`.

## Task → reference

Read the matching reference before doing that kind of work.

| When you are…                                                                                                  | Read                                                       |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Unsure how a rule reads, or reviewing code against one                                                         | [`references/rules.md`](references/rules.md)               |
| Adding a module, guard, interceptor, pipe, middleware, decorator or Prisma model; wanting the reference module | [`references/structure.md`](references/structure.md)       |
| Debugging a 4xx/5xx or boot error, or asking why a rule exists (the ADRs)                                      | [`references/request-flow.md`](references/request-flow.md) |
| Writing error handling, a `catch`, or a stream                                                                 | [`references/errors.md`](references/errors.md)             |

## Common mistakes

| Mistake                                               | Fix                                                       |
| ----------------------------------------------------- | --------------------------------------------------------- |
| Relative import without `.js`                         | Add `.js`; ESM resolution fails at runtime otherwise      |
| `import { Request } from 'express'`                   | `FastifyRequest` from `'fastify'`                         |
| Building `{ success, message, data }` in a controller | Return `{ message, data }`                                |
| `throw new Error('not found')`                        | `throw new NotFoundException(TOPIC_NOT_FOUND)`            |
| String literal in `throw new NotFoundException('…')`  | A constant from `api.constants.ts`                        |
| Module created but endpoint 404s                      | Not registered in `app.module.ts`                         |
| Business logic or Prisma call inside a controller     | Move it to the service                                    |
| `@Get(':id')` declared above `@Get('literal')`        | Literal routes first, or the literal is captured as an id |

## Conventions this project does not follow

- **Default exports.** Everything on the server is a named export.
- **Express anywhere.** Fastify only.
- **Reading `process.env` in services, controllers or guards you write.** `ConfigService` only (rule 8).
- **Mongoose / TypeORM / MikroORM.** Prisma only.
- **Jest.** Vitest.
- **Inline Swagger response shapes in a controller.** They live in `common/schemas/<name>/`.

## When in doubt

Read `server/src/modules/topic/` end to end and mirror it. Where the existing code does something these rules do not cover, the existing code is the source of truth. Where it **contradicts** a rule, the rule wins for new code and the existing file is backlog (rule 8 lists one).
