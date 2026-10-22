# The provider router (providers.ts)

Reference for the `mastra-ai` skill. What `providers.ts` exports, how failover works, and how to add a provider. Load when changing the LLM provider or debugging which model ran.

## The provider router (`providers.ts`)

### What it exports

| Export                  | Type                                           | Purpose                                                           |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `defaultModel`          | `{ nvidia: () => string, groq: () => string }` | Default model per provider, overridable via env                   |
| `ProviderName`          | `type`                                         | `'nvidia' \| 'groq'`                                              |
| `pickProvider()`        | `function`                                     | Returns which provider to use based on env and API keys           |
| `getModel()`            | `function`                                     | Returns a `LanguageModelV1` by calling `provider.chat(modelName)` |
| `chatWithFailover<T>()` | `async function`                               | Tries NVIDIA first, then Groq; returns first success              |
| `nvidiaProvider`        | `const`                                        | `createOpenAI({...})` instance for NVIDIA NIM                     |
| `groqProvider`          | `const`                                        | `createOpenAI({...})` instance for Groq                           |

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
