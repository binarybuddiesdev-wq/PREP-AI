---
name: api-design
description: Use when creating, modifying or reviewing a backend HTTP endpoint in the PrepAI NestJS server — routes, controllers, DTOs, response schemas, status codes, error messages, the response envelope, or routes/*-api-spec.md. Triggers on work in server/src/modules, server/src/common or routes/. Not for Prisma schemas, AI agents or the frontend.
---

# PrepAI Backend API

Builds an endpoint the same way every time: same file layout, envelope, validation, logging, Swagger and spec. Framework rules (imports, Fastify, logging) are in `nestjs-developer`; data access is in `prisma-database`.

## When to use

- Creating a module under `server/src/modules/<name>/`, or adding an endpoint to one
- Creating a DTO (body, query, path params)
- Adding a message, tag, route or operation to `server/src/common/constants/api.constants.ts`
- Creating a Swagger response schema under `server/src/common/schemas/<name>/`
- Changing a route, field, status code or message that the UI consumes
- Updating `routes/<name>-api-spec.md`

## The response envelope

Every successful handler returns `{ message, data }`:

```ts
return { message: CREATE_TOPIC_SUCCESS, data };
```

The global `TransformInterceptor` wraps it as `{ success: true, message, data }`. `data` may be `null`, an object or an array. Errors come from Nest `HttpException` subclasses, formatted by the global `GlobalExceptionFilter` as `{ success: false, message, statusCode, path, timestamp }`. Never build either shape yourself.

## Status codes

| Method                      | Success                  | Common errors                    |
| --------------------------- | ------------------------ | -------------------------------- |
| `POST` (create)             | `201`                    | `400` validation, `409` conflict |
| `POST` (action, not create) | `200`, or `202` if async | `400`, `403`, `404`              |
| `GET`                       | `200`                    | `404`                            |
| `PATCH`                     | `200`                    | `400`, `404`, `409`              |
| `DELETE`                    | `200` with `{ message }` | `404`, `409`                     |

Set the status explicitly with `@HttpCode(...)` on every handler (`topic.controller.ts` is the pattern). A record the caller cannot see is **404**, not 403 (full rule in [`references/contract.md`](references/contract.md)).

## Non-negotiable rules

One line each; full text and examples in [`references/rules.md`](references/rules.md).

1. No `console.log` — `@InjectPinoLogger(X.name)`.
2. No bare data from a controller — return `{ message, data }`.
3. `@HttpCode(...)` on every handler.
4. No `any` in a DTO field.
5. No business logic in a controller: 2–3 lines — call the service, return `{ message, data }`.
6. Relative and `@/` imports end in `.js`, including `./dto/index.js` and `@/common/index.js`.
7. Fastify, not Express: use `FastifyRequest` from `'fastify'`.
8. No hard-coded success or error strings; constants live in `api.constants.ts`.
9. Never modify the global `TransformInterceptor` or `GlobalExceptionFilter` for one endpoint.
10. No `process.env` in a controller or service — `ConfigService`.

## A new module needs

`<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, both spec files, `dto/` with a barrel `index.ts`, entries in `api.constants.ts`, a response schema under `common/schemas/<name>/`, registration in `app.module.ts`, and `routes/<name>-api-spec.md`. The exact steps are in [`references/new-module.md`](references/new-module.md). **Read the spec first.** If `routes/<name>-api-spec.md` does not exist, stop and write it with the user before coding.

## Task → reference

| When you are…                                                                                                       | Read                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Creating a module, or adding one endpoint to a module                                                               | [`references/new-module.md`](references/new-module.md)           |
| Writing or reviewing a controller against the full rules                                                            | [`references/rules.md`](references/rules.md)                     |
| Changing anything the UI consumes: fields, status codes, null handling, bounds, who may see a record, replay safety | [`references/contract.md`](references/contract.md)               |
| Choosing a database, provisioning users, enforcing quotas                                                           | [`references/project-context.md`](references/project-context.md) |

## Common mistakes

| Mistake                                           | Fix                                                   |
| ------------------------------------------------- | ----------------------------------------------------- |
| Hand-built `{ success: true, … }` in a controller | Return `{ message, data }`                            |
| No `@HttpCode` on a handler                       | Add it, even for the default                          |
| Message string typed into the controller          | Constant in `api.constants.ts`                        |
| Response schema written inline in the controller  | `common/schemas/<name>/`                              |
| Endpoint changed, spec not                        | Update `routes/<name>-api-spec.md` in the same change |
| Contract changed, `ui/` not                       | List the `ui/` impact; ship both together             |

## When in doubt

Mirror `server/src/modules/topic/`: every convention here is demonstrated there. If your new code looks different from it, you are probably wrong.
