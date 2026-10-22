# Adding an agent and troubleshooting

Reference for the `mastra-ai` skill. The step-by-step to add an agent, a symptom-to-cause table, and what this project deliberately does not do.

## Adding a new agent — the procedure

1. **Create the agent file** in `server/src/mastra/agents/<name>-agent.ts`.
   - Import `Agent` from `@mastra/core/agent`.
   - Import `getModel` from `../providers.js`.
   - Define `instructions` — the system prompt as a template literal.
   - Export a named const with camelCase matching the file name.
   - Constructor: `{ id, name, instructions, model: getModel() }`.

2. **Define the Zod schema** in `<name>.types.ts` co-located with
   the service/controller that will use the agent.
   - Request schema for `ZodValidationPipe`.
   - Response schema for `structuredOutput.schema`.
   - `z.infer<>` type derived from the schema.
   - class-validator DTOs for Swagger.
   - Interface for the service return value.

3. **Create the service** that calls the agent:
   - Import `mastra` from `../../mastra/mastra.config.js`.
   - `const agent = mastra.getAgent('<id>');`
   - `await agent.generate(prompt, { structuredOutput: { ... } })`.
   - Return `response.object` (or a transformed version of it).

4. **Create the controller** with `ZodValidationPipe` and the
   `ZodValidationPipe(requestSchema)` decorator.

5. **Register the agent in `mastra.config.ts`:**
   - Import the agent const.
   - Add it to the `agents` map.

6. **Create the spec file** and mock `mastra.config.js` with
   `vi.mock`.

7. **Update the route spec** at `routes/<name>-api-spec.md`.

## When something is broken

| Symptom                                                               | First place to look                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `mastra.getAgent('id')` returns `undefined`                           | Agent not registered in `mastra.config.ts`, or `id` mismatch              |
| `agent.generate()` throws timeout                                     | Provider unreachable (NVIDIA/Groq API key missing or expired)             |
| Structured output fails (falls back to `fallbackValue`)               | Zod schema mismatch — the agent's output doesn't match the schema         |
| `response.object` is `undefined`                                      | `jsonPromptInjection: true` missing, or agent returned plain text         |
| `TypeError: Cannot read properties of undefined (reading 'generate')` | `getAgent` returned `undefined` — check `id` and registration             |
| Provider error (401/403)                                              | Missing or expired API key — check `.env.example` and `env.validation.ts` |
| Wrong model called                                                    | `LLM_PROVIDER` env var or `NVIDIA_MODEL`/`GROQ_MODEL` override            |
| `vi.mock` not applied, real module loaded                             | `vi.mock()` must be at top level of the spec file, not inside `describe`  |

## Conventions this project does NOT follow (intentionally)

- **Tools on agents.** The existing agents have no tools. If you
  need tools, add them explicitly — but don't assume tools are
  the default.
- **Middleware.** No middleware is defined on agents currently.
- **Multiple models per agent.** Every agent uses `getModel()` —
  the same provider/model. Don't configure a different model per
  agent unless you have a reason to.
- **Agents as NestJS providers.** Agents are imported via the
  `mastra` singleton, not injected as providers.
- **`model:` as anything other than `getModel()`.** The model
  is always resolved through the provider router.
- **NestJS module registration for agents.** Agents are not
  `@Injectable()` providers — they're singletons managed by the
  `Mastra` class.
