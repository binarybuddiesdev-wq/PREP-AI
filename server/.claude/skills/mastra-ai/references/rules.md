# Mastra rules — full text and examples

Reference for the `mastra-ai` skill. The seven non-negotiable rules with correct and wrong examples.

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
    newAgent, // ← new agent added here
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
const fallbackValue = { topic: 'unknown', summary: '' }; // extra field
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
