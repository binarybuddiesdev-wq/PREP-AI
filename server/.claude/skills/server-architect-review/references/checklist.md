# Backend (server/**) checklist

Reference for the `server-architect-review` skill. The checks a `server/**` judgment dispatch runs. Load when reviewing a change under `server/`.

## What to flag — backend (`server/**`)

### Hard violations (Should-fix)

- **A controller constructs the envelope itself** or returns bare data
  instead of `{ message, data }` — `api-design/SKILL.md` § The response
  envelope
- **Business logic sitting in a controller** instead of the service —
  `nestjs-developer/SKILL.md`, the controller should be 2-3 lines
- **A relative or `@/` import missing its `.js` extension** —
  `nestjs-developer/SKILL.md` Rule #1
- **`express` types or `Request`/`Response` from `@nestjs/common`** instead
  of Fastify types — `nestjs-developer/SKILL.md` Rule #2
- **`console.log` in a service or controller** instead of
  `@InjectPinoLogger` — `nestjs-developer/SKILL.md` Rule #3
- **A thrown raw `Error`** instead of a NestJS `HttpException` subclass —
  `nestjs-developer/SKILL.md` Rule #4
- **`process.env.X` read directly in a controller, service, guard,
  interceptor, pipe or middleware the diff adds or changes** instead of
  through `ConfigService` — `nestjs-developer/SKILL.md` Rule #8. Not a
  finding: `src/mastra/providers.ts`, `src/config/**`, `src/prisma/**`, or
  an existing read the diff did not add
- **A hardcoded string literal** where `api.constants.ts` should hold the
  message — `nestjs-developer/SKILL.md` Rule #9
- **A query missing the `userId` filter from the JWT**, or filtering on
  `dto.userId` / a path param instead — `prisma-database/SKILL.md` §2,
  the IDOR rule. This is the single highest-severity backend finding —
  treat it as a Blocker, not a Should-fix
- **A new Postgres call site missing the `?.` on `client_`** —
  `prisma-database/SKILL.md`, the optional-chaining is load-bearing
- **A new filtered/sorted column with no `@@index`** —
  `prisma-database/SKILL.md` §4
- **An agent added without registration in `mastra.config.ts`**, or a
  direct provider call (`nvidiaProvider.chat(...)`) instead of
  `getModel()` — `mastra-ai/SKILL.md`, non-negotiable rules #1-2

### Security authoring gaps (Should-fix, treat as Blocker if exploitable)

Consult `server-developer` § Security authoring notes for the full list.
The checks that matter most for this codebase specifically:

- A new endpoint or service path that executes, evaluates, or shells out
  to user-supplied code **outside** the existing Piston sandbox flow
- A prompt template that concatenates raw user input into an LLM system
  prompt with no delimiting/escaping — prompt-injection surface
- A new webhook handler that doesn't verify its signature (mirror
  `modules/user/webhook.controller.ts`'s Svix verification)
- A secret, API key, or credential read into a value that reaches the
  client/browser (a DTO response field, a public config endpoint)
- A new mutating endpoint with an irreversible side effect (charge,
  delete, session-consuming action) with no `Idempotency-Key` handling —
  flag as Should-fix per `docs/architecture/TODO.md` item #7, not a
  blocker until that doc's idempotency design lands

### What NOT to flag on a `server/**` dispatch (other skills' territory)

- Frontend layer/naming/presentational rules — the `ui-architect-review` skill's job
- Test coverage gaps — `backend-qa-engineer`'s own dispatch (step 5)
- General correctness bugs with no architectural angle — the default
  correctness pass (step 6)
