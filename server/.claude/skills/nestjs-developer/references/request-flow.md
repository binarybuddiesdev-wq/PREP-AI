# Request flow, ADRs and troubleshooting

Reference for the `nestjs-developer` skill. What happens to a request, the architecture decisions behind the rules, and where to look when something breaks. Load when debugging a request or when a rule's reason is unclear.

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
GlobalExceptionFilter (global)        — formats { success: false, message, statusCode, path, timestamp }
```

If you need to add a step (rate limit, request id, audit log), the
question is: **which step of the flow does it belong in?** Most cross-cutting
concerns are middleware, guards, or interceptors — not controller code.

## Project-specific decisions (encoded as ADRs)

Read these once. They explain the _why_ behind the rules above.

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

## When something is broken

| Symptom                           | First place to look                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 401 Unauthorized                  | `ClerkAuthGuard` — token format, CLERK_SECRET_KEY, webhook fired?                                              |
| 403 Forbidden                     | `RolesGuard` — `@Roles('ADMIN')` mismatch, or Clerk webhook hasn't fired so `user.role` is undefined           |
| 404 Not Found                     | Service threw `NotFoundException` — query by id, was the row created?                                          |
| 409 Conflict                      | Service threw `ConflictException` — duplicate check failing or wrong                                           |
| 422 Validation                    | DTO decorator mismatch — class-validator stripped the field?                                                   |
| 500 Internal                      | Stack trace in `logs/`. Common causes: Prisma not generated, env var unset, Postgres client not generated yet  |
| Endpoint not found                | Module not registered in `app.module.ts`                                                                       |
| Env validation error at boot      | `env.validation.ts` rejected an env var — usually a typo or missing required var                               |
| Postgres "Database not available" | `POSTGRESQL_URL` unset OR client not generated yet. The service no-ops gracefully; check the warn log at boot. |
