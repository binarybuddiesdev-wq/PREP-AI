---
name: mastra-ai
description: Use when working with Mastra AI agents in the PrepAI server — adding a new agent, modifying an existing agent, changing the provider router, adding tools, wiring a new LLM provider, or debugging agent generation failures. Triggers on any work inside server/src/mastra/.
---

# Mastra AI

> If you are adding or modifying AI agents, the LLM provider
> router, or any Mastra integration in the PrepAI server, this
> is your playbook. It encodes the conventions of the Mastra
> setup, the provider router, agent structure, and the usage
> pattern.
>
> For the broader backend context (how agents fit into modules,
> controllers, services), see the `nestjs-developer` skill.

## When to use this skill

Use this skill whenever you are:

- Adding a new Mastra agent (new file in `mastra/agents/`)
- Modifying an existing agent's instructions, schema, or behavior
- Changing the LLM provider (NVIDIA, Groq, or adding a new one)
- Adding tools, middleware, or other Mastra features to an agent
- Wiring a new agent into `mastra.config.ts` and a module
- Adding or modifying the Zod schema for structured output
- Debugging an agent generation failure (timeout, schema mismatch,
  provider error)
- Adding a new LLM provider (e.g., Anthropic, OpenAI directly)

If the work is only a controller endpoint or a service method
that doesn't involve Mastra, the `api-design` or
`nestjs-developer` skill applies instead.

## The Mastra setup at a glance

- **SDK:** `@mastra/core` v1.47.0
- **Providers:** `@ai-sdk/openai` v4.0.2 (both NVIDIA and Groq
  are OpenAI-compatible)
- **Schema validation:** Zod v4
- **Directory:** `server/src/mastra/`
- **Agents:** `server/src/mastra/agents/*.ts`
- **Provider router:** `server/src/mastra/providers.ts`
- **Singleton:** `server/src/mastra/mastra.config.ts`
- **ESM / NodeNext:** every relative import ends with `.js`

## The directory structure

```
server/src/mastra/
├── mastra.config.ts          # Mastra singleton — agents map
├── providers.ts              # LLM provider router
└── agents/
    ├── theory-evaluator-agent.ts   # Theory answer evaluator
    └── tech-expert-agent.ts        # Technology Q&A agent
```

- No tools directory yet (agents are intentionally minimal —
  just `id`, `name`, `instructions`, `model`)
- No middleware directory yet
- `mastra.config.ts` is the single point of registration —
  every agent must be added there

## The provider router (`providers.ts`)

### What it exports

| Export | Type | Purpose |
|---|---|---|
| `defaultModel` | `{ nvidia: () => string, groq: () => string }` | Default model per provider, overridable via env |
| `ProviderName` | `type` | `'nvidia' \| 'groq'` |
| `pickProvider()` | `function` | Returns which provider to use based on env and API keys |
| `getModel()` | `function` | Returns a `LanguageModelV1` by calling `provider.chat(modelName)` |
| `chatWithFailover<T>()` | `async function` | Tries NVIDIA first, then Groq; returns first success |
| `nvidiaProvider` | `const` | `createOpenAI({...})` instance for NVIDIA NIM |
| `groqProvider` | `const` | `createOpenAI({...})` instance for Groq |

### How it works

1. Two providers are created with `createOpenAI()` from
   `@ai-sdk/openai`. Both are OpenAI-API-compatible.
2. NVIDIA is the primary (`https://integrate.api.nvidia.com/v1`).
3. Groq is the free-tier fallback (`https://api.groq.com/openai/v1`).
4. `getModel()` picks the provider and returns
   `provider.chat(defaultModel[name]())`.
5. Model names are overridable via env vars
   (`NVIDIA_MODEL`, `GROQ_MODEL`).
6. `LLM_PROVIDER` env var (`'nvidia' | 'groq'`) overrides the
   auto-detection. If unset, `pickProvider()` chooses based on
   which API key is present.

### Adding a new provider

1. Add the provider instance:
   ```ts
   const anthropicProvider = createAnthropic({
     apiKey: process.env['ANTHROPIC_API_KEY'],
     baseURL: 'https://api.anthropic.com/v1',
   });
   ```
2. Add to `defaultModel`:
   ```ts
   export const defaultModel = {
     nvidia: () => process.env['NVIDIA_MODEL'] ?? 'meta/llama-3.1-8b-instruct',
     groq: () => process.env['GROQ_MODEL'] ?? 'qwen/qwen3.8-27b',
     anthropic: () => process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514',
   } as const;
   ```
3. Update `pickProvider()` to include the new provider.
4. Update `env.validation.ts` with the new env vars
   (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`).
5. Update `.env.example` with the new env vars.
6. Update `server/src/mastra/providers.ts` imports if needed
   (`@ai-sdk/anthropic` or equivalent).

## The agent structure

### Every agent follows this exact shape

```ts
import { Agent } from '@mastra/core/agent';
import { getModel } from '../providers.js';

export const techExpertAgent = new Agent({
  id: 'techExpertAgent',
  name: 'Tech Expert Agent',
  instructions: `...`,
  model: getModel(),
});
```

**The 4 required properties:**

| Property | Type | Convention |
|---|---|---|
| `id` | `string` | camelCase matching the export name (`'techExpertAgent'`) |
| `name` | `string` | Human-readable title (`'Tech Expert Agent'`) |
| `instructions` | `string` | Template literal — the system prompt |
| `model` | `LanguageModelV1` | Always `getModel()` — no other model configuration |

**No tools, no schema, no middleware** are defined on agents
currently. They are intentionally minimal. If you need tools or
middleware, add them here — but the existing agents do not use
them, so follow the existing pattern unless you have a reason not
to.

**The export convention:** every agent is a named const using
camelCase matching the `id`. The file name matches the export:
`tech-expert-agent.ts` exports `techExpertAgent`.

## The Mastra singleton (`mastra.config.ts`)

```ts
import { Mastra } from '@mastra/core';
import { techExpertAgent } from './agents/tech-expert-agent.js';
import { theoryEvaluatorAgent } from './agents/theory-evaluator-agent.js';

export const mastra = new Mastra({
  agents: {
    techExpertAgent,
    theoryEvaluatorAgent,
  },
});
```

Every agent must be registered in the `agents` map of the
`Mastra` instance. The keys are the camelCase export names, and
the values are the exported consts.

## How agents are used in services

Agents are **not** registered as NestJS providers/services. Each
module imports the `mastra` singleton directly and calls
`mastra.getAgent('agentId')`:

```ts
import { mastra } from '../../mastra/mastra.config.js';

// Inside a service method:
const agent = mastra.getAgent('techExpertAgent');
const response = await agent.generate(prompt, {
  structuredOutput: {
    schema: techAnswerSchema,
    jsonPromptInjection: true,
    errorStrategy: 'fallback',
    fallbackValue: fallback,
  },
});
```

### Structured output pattern

Every `agent.generate()` call with structured output follows
this exact shape:

```ts
const response = await agent.generate(prompt, {
  structuredOutput: {
    schema: someZodSchema,        // Zod schema for validation
    jsonPromptInjection: true,    // force JSON output
    errorStrategy: 'fallback',    // on error, use fallbackValue
    fallbackValue: { ... },       // plain object fallback
  },
});

// response has .object (parsed structured data) and .text (raw string)
const data = response.object;
```

| Property | Purpose |
|---|---|
| `schema` | Zod schema — validates and shapes the output |
| `jsonPromptInjection` | `true` — forces the agent to return JSON |
| `errorStrategy` | `'fallback'` — if structured output fails, use `fallbackValue` |
| `fallbackValue` | Plain object — returned when structured output fails |

## The types and schemas pattern

Each module that uses Mastra defines its types in a
`<name>.types.ts` file co-located with the service/controller:

```ts
// tech-expert.types.ts
import { z } from 'zod';

// Zod schemas for validation + structured output
export const techExpertRequestSchema = z.object({
  question: z.string().min(1),
});

export const techAnswerSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  examples: z.array(z.string()),
  relatedTopics: z.array(z.string()),
});

export type TechAnswer = z.infer<typeof techAnswerSchema>;

// NestJS DTOs with class-validator + swagger decorators
export class TechExpertRequestDto implements ITechExpertRequest { ... }
export class TechExpertResponseDto implements ITechExpertResponse { ... }

// Interface shapes for service return values
export interface ITechExpertRequest { question: string; }
export interface ITechExpertResponse { data: ...; error: string | null; meta: Record<string, unknown>; }
```

The pattern:

1. **Zod schemas** for request validation and structured output
2. **`z.infer<typeof schema>`** for TypeScript types derived from Zod
3. **class-validator DTOs** with `@ApiProperty` decorators for Swagger
4. **Interfaces** for the service return value shape

The controller uses `ZodValidationPipe(techExpertRequestSchema)`
for request validation, and the service uses the Zod schema as
the `structuredOutput.schema`.

## The controller pattern for Mastra-powered endpoints

```ts
@Controller('tech-expert')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('USER')
export class TechExpertController {
  constructor(private readonly techExpertService: TechExpertService) {}

  @Post()
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(techExpertRequestSchema))
  @ApiOperation({ summary: 'Ask a technology question' })
  public async ask(@Body() body: TechExpertRequestDto): Promise<ITechExpertResponse> {
    return this.techExpertService.askQuestion(body);
  }
}
```

- Uses `ZodValidationPipe` with the Zod schema (not class-validator pipe)
- Returns the interface type (`ITechExpertResponse`)
- Guards and roles applied at controller level
- Module wiring: `@Module({ controllers: [TechExpertController], providers: [TechExpertService] })`

## The testing pattern for Mastra-powered services

Mock the mastra config module using `vi.mock` at the top level:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TechExpertService } from './tech-expert.service.js';

const mockGenerate = vi.fn();
vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: {
    getAgent: () => ({
      generate: mockGenerate,
    }),
  },
}));

describe('TechExpertService', () => {
  let service: TechExpertService;

  beforeEach(async () => {
    mockGenerate.mockResolvedValue({
      object: { topic: 'Arrays' },
      text: '{"topic":"Arrays"}',
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechExpertService],
    }).compile();
    service = module.get(TechExpertService);
  });

  it('returns structured answer', async () => {
    const result = await service.askQuestion({ question: 'What are arrays?' });
    expect(result.data).toEqual({ topic: 'Arrays' });
    expect(mockGenerate).toHaveBeenCalled();
  });
});
```

The mock `generate` must return an object with both `.object`
and `.text`:

```ts
mockGenerate.mockResolvedValue({
  object: { /* parsed structured data */ },
  text: JSON.stringify({ /* same data */ }),
});
```

`response.object` gives you the parsed structured data.
`response.text` gives the raw string. The service typically
returns `response.object`.

## The non-negotiable rules

### 1. Use `getModel()` — never call a provider directly

```ts
// CORRECT
model: getModel(),

// WRONG
model: nvidiaProvider.chat('meta/llama-3.1-8b-instruct'),
```

`getModel()` handles provider selection, model name overrides,
and failover. Calling a provider directly bypasses all of that.

### 2. Every agent is registered in `mastra.config.ts`

```ts
// CORRECT — agent is in the agents map
export const mastra = new Mastra({
  agents: {
    techExpertAgent,
    newAgent,  // ← new agent added here
  },
});

// WRONG — agent exists but is not registered
// mastra.getAgent('newAgent') returns undefined
```

If you add an agent file but forget to register it in
`mastra.config.ts`, `mastra.getAgent('id')` returns `undefined`.

### 3. Use `mastra.getAgent('id')` — not a direct import

```ts
// CORRECT
const agent = mastra.getAgent('techExpertAgent');

// WRONG
import { techExpertAgent } from '../../mastra/agents/tech-expert-agent.js';
const agent = techExpertAgent;
```

The `mastra` singleton manages agent lifecycle and state.
Importing the agent directly bypasses this and breaks the
singleton pattern.

### 4. The `id` must match the export name and the getAgent call

```ts
// In the agent file:
export const techExpertAgent = new Agent({
  id: 'techExpertAgent',  // ← must match
});

// In the service:
const agent = mastra.getAgent('techExpertAgent');  // ← must match

// In mastra.config.ts:
agents: { techExpertAgent },  // ← must match
```

All three must agree. If any one is different, `getAgent` fails
silently or throws.

### 5. Always provide `fallbackValue` for structured output

```ts
// CORRECT
const response = await agent.generate(prompt, {
  structuredOutput: {
    schema: someSchema,
    jsonPromptInjection: true,
    errorStrategy: 'fallback',
    fallbackValue: { topic: 'unknown', summary: '', keyPoints: [] },
  },
});

// WRONG — no fallbackValue; if structured output fails, the
// request crashes instead of returning a graceful fallback
const response = await agent.generate(prompt, {
  structuredOutput: { schema: someSchema, jsonPromptInjection: true },
});
```

The `fallbackValue` must match the shape of the Zod schema so
that `response.object` is always a valid object.

### 6. The Zod schema must match the fallback value shape

```ts
// CORRECT — schema and fallbackValue have the same shape
const techAnswerSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
});
const fallbackValue = { topic: 'unknown', summary: '', keyPoints: [] };

// WRONG — mismatch causes runtime validation errors
const techAnswerSchema = z.object({ topic: z.string() });
const fallbackValue = { topic: 'unknown', summary: '' };  // extra field
```

The `fallbackValue` is used as-is when structured output fails,
but it must still pass `schema.parse()` for the response to be
valid.

### 7. Use `.js` extensions in all imports

```ts
// CORRECT
import { getModel } from '../providers.js';
import { mastra } from '../../mastra/mastra.config.js';
import { ApiTags } from '@/common/index.js';

// WRONG
import { getModel } from '../providers';
import { mastra } from '../../mastra/mastra.config';
import { ApiTags } from '@/common';
```

ESM / NodeNext — both relative imports (`./`, `../`) AND path alias imports (`@/...`) SHOULD include the `.js` extension.

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

| Symptom | First place to look |
|---|---|
| `mastra.getAgent('id')` returns `undefined` | Agent not registered in `mastra.config.ts`, or `id` mismatch |
| `agent.generate()` throws timeout | Provider unreachable (NVIDIA/Groq API key missing or expired) |
| Structured output fails (falls back to `fallbackValue`) | Zod schema mismatch — the agent's output doesn't match the schema |
| `response.object` is `undefined` | `jsonPromptInjection: true` missing, or agent returned plain text |
| `TypeError: Cannot read properties of undefined (reading 'generate')` | `getAgent` returned `undefined` — check `id` and registration |
| Provider error (401/403) | Missing or expired API key — check `.env.example` and `env.validation.ts` |
| Wrong model called | `LLM_PROVIDER` env var or `NVIDIA_MODEL`/`GROQ_MODEL` override |
| `vi.mock` not applied, real module loaded | `vi.mock()` must be at top level of the spec file, not inside `describe` |

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

## When in doubt

Read `tech-expert-agent.ts` and `theory-evaluator-agent.ts`.
Mirror them exactly. If your agent file looks different, you're
probably adding something the existing agents don't have — and
that's fine, but document why in a comment or ADR.
