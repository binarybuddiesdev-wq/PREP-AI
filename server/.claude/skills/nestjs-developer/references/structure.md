# Backend structure, procedures and the reference module

Reference for the `nestjs-developer` skill. The `server/src` layout, the reference module, and the step-by-step procedures for a new module, a guard/interceptor/pipe/middleware/decorator, and a Prisma model. Load when adding any of those.

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
│   ├── filters/                      # GlobalExceptionFilter (global)
│   ├── middleware/                   # SanitizeMiddleware, LoggerMiddleware
│   ├── pipes/                       # ZodValidationPipe
│   ├── decorators/                  # @Public, @Roles, @CurrentUser
│   ├── utils/                       # role-limits, helpers
│   └── types/                        # shared TS types
├── config/                            # env validation, app/swagger/logger config
├── prisma/                           # PrismaService, PrismaPostgresqlService
└── mastra/                           # AI agents, providers
```

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
