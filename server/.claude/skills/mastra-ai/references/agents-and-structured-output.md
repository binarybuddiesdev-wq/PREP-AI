# Agents, the Mastra singleton and structured output

Reference for the `mastra-ai` skill. The exact shape of an agent, `mastra.config.ts`, how services call agents, and the structured-output pattern. Load when adding or changing an agent.

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

| Property       | Type              | Convention                                               |
| -------------- | ----------------- | -------------------------------------------------------- |
| `id`           | `string`          | camelCase matching the export name (`'techExpertAgent'`) |
| `name`         | `string`          | Human-readable title (`'Tech Expert Agent'`)             |
| `instructions` | `string`          | Template literal — the system prompt                     |
| `model`        | `LanguageModelV1` | Always `getModel()` — no other model configuration       |

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

| Property              | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `schema`              | Zod schema — validates and shapes the output                   |
| `jsonPromptInjection` | `true` — forces the agent to return JSON                       |
| `errorStrategy`       | `'fallback'` — if structured output fails, use `fallbackValue` |
| `fallbackValue`       | Plain object — returned when structured output fails           |
