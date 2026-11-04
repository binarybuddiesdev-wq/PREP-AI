/**
 * LLM Providers
 *
 * Centralised provider configuration for the Mastra agents. We support two
 * providers today, both OpenAI-API-compatible:
 *
 *   1. **NVIDIA NIM** (primary)  — `process.env.NVIDIA_API_KEY`
 *      Model: meta/llama-3.1-8b-instruct (or NVIDIA_MODEL override)
 *      URL:   https://integrate.api.nvidia.com/v1
 *
 *   2. **Groq** (fallback)        — `process.env.GROQ_API_KEY`
 *      Model: qwen/qwen3.8-27b (or GROQ_MODEL override)
 *      URL:   https://api.groq.com/openai/v1
 *      Free tier: 2M tokens/day, 30 RPM, OpenAI-compatible.
 *      Sign up: https://console.groq.com (no credit card required)
 *
 * Why both?
 *   - NVIDIA NIM is what we have already integrated. It works.
 *   - Groq is the free-tier fallback in case NVIDIA is rate-limited,
 *     out of credits, or has an outage. The 2M TPD on Qwen 3.8 is enough
 *     for a solo project's daily usage, and switching is a one-line
 *     env change.
 *
 * How to choose which one to use at runtime:
 *   - Default: try NVIDIA; if it fails (auth error, rate limit, network),
 *     fall back to Groq. This is the "auto-failover" path used in prod.
 *   - For A/B testing: set `LLM_PROVIDER=groq` (or `=nvidia`) in .env to
 *     force one provider. Used by `pnpm test` to keep eval results stable.
 *   - For local dev: either works. NVIDIA if you have credits, Groq if
 *     you don't.
 *
 * Both providers expose the same OpenAI-shaped API surface, so the agent
 * code is provider-agnostic.
 */

import { createOpenAI } from '@ai-sdk/openai';

/**
 * The default model name for each provider. Override via env if you want
 * to try a different model on the same provider (e.g. NVIDIA has
 * llama-3.3-nemotron-super-49b-v1.5; Groq has openai/gpt-oss-120b, etc.).
 */
export const defaultModel = {
  nvidia: () => process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct',
  groq: () => process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
} as const;

export type ProviderName = keyof typeof defaultModel;

/**
 * Pick which provider to use based on:
 *   1. `LLM_PROVIDER` env var if set (explicit override)
 *   2. NVIDIA if its key is set (default)
 *   3. NVIDIA as a placeholder model when no key is present, so the app can
 *      start and report missing AI configuration only when an AI endpoint is used
 *
 * The NVIDIA placeholder keeps Mastra agents constructible when AI is not configured.
 * `chatWithFailover` refuses to make a request until a provider key is present.
 */
export function pickProvider(): ProviderName {
  const forced = process.env.LLM_PROVIDER;
  if (forced) {
    if (forced === 'nvidia' || forced === 'groq') return forced;
    throw new Error(`Unsupported LLM_PROVIDER "${forced}". Expected "nvidia" or "groq".`);
  }
  if (process.env.NVIDIA_API_KEY) return 'nvidia';
  if (process.env.GROQ_API_KEY) return 'groq';
  return 'nvidia';
}

/**
 * Get the active model for an agent. Returns the `LanguageModelV1` object
 * the AI SDK expects, pre-configured for the chosen provider.
 *
 * Use this in agent definitions:
 *
 *   import { getModel } from '../providers.js';
 *   const model = getModel();  // auto-picks NVIDIA or Groq
 */
export function getModel(
  name: ProviderName = pickProvider(),
  modelName?: string
): ReturnType<ReturnType<typeof createOpenAI>['chat']> {
  const provider = createOpenAI({
    apiKey: name === 'nvidia' ? process.env.NVIDIA_API_KEY || '' : process.env.GROQ_API_KEY || '',
    baseURL:
      name === 'nvidia'
        ? (process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1')
        : (process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1'),
  });
  return provider.chat(modelName ?? defaultModel[name]());
}

/**
 * Run a chat completion with automatic failover. If the primary provider
 * throws (auth error, 429 rate limit, 5xx, network), try the other one.
 *
 * Use this from code that does one-off LLM calls (e.g. RAG generation,
 * ad-hoc eval) when you want a result no matter what. For agents, prefer
 * `getModel()` so the agent keeps the same model across a conversation.
 */
export async function chatWithFailover<T>(
  fn: (provider: ProviderName) => Promise<T>,
  onFailover?: (from: ProviderName, to: ProviderName) => void | Promise<void>,
  onAttempt?: (
    provider: ProviderName,
    fallback: boolean,
    durationSeconds: number
  ) => void | Promise<void>
): Promise<T> {
  const errors: unknown[] = [];
  let previousProvider: ProviderName | undefined;

  const configuredOverride = process.env.LLM_PROVIDER;
  if (configuredOverride && configuredOverride !== 'nvidia' && configuredOverride !== 'groq') {
    throw new Error(
      `Unsupported LLM_PROVIDER "${configuredOverride}". Expected "nvidia" or "groq".`
    );
  }
  const forcedProvider = configuredOverride as ProviderName | undefined;
  const providerOrder: ProviderName[] = forcedProvider
    ? [forcedProvider]
    : (['nvidia', 'groq'] as ProviderName[]).filter(hasKey);

  for (const [index, name] of providerOrder.entries()) {
    if (!hasKey(name)) continue;
    const startedAt = performance.now();
    try {
      const result = await fn(name);
      if (previousProvider && onFailover) {
        try {
          void Promise.resolve(onFailover(previousProvider, name)).catch(() => undefined);
        } catch {
          // Telemetry must not change the provider result or retry behavior.
        }
      }
      return result;
    } catch (err) {
      errors.push({ provider: name, error: err });
      previousProvider = name;
    } finally {
      if (onAttempt) {
        try {
          void Promise.resolve(
            onAttempt(name, index > 0, (performance.now() - startedAt) / 1_000)
          ).catch(() => undefined);
        } catch {
          // Telemetry must not change provider results or retry behavior.
        }
      }
    }
  }

  // If a forced provider was set, only that one was tried; surface its error.
  if (errors.length === 0) {
    throw new Error('No LLM provider configured. Set NVIDIA_API_KEY or GROQ_API_KEY in .env');
  }
  const summary = errors
    .map(
      (e) =>
        `${(e as { provider: string }).provider}: ${(e as { error: unknown }).error instanceof Error ? (e as { error: Error }).error.message : String((e as { error: unknown }).error)}`
    )
    .join(' | ');
  throw new Error(`All LLM providers failed. ${summary}`);
}

/**
 * Stream provider output with fallback only until the first chunk is emitted.
 * Once output is visible to a client, changing providers would splice two
 * different model responses together, so a later failure is terminal.
 */
export async function* streamWithFailover<T>(
  fn: (provider: ProviderName) => Promise<AsyncIterable<T>>,
  onFailover?: (from: ProviderName, to: ProviderName) => void | Promise<void>,
  onAttempt?: (
    provider: ProviderName,
    fallback: boolean,
    durationSeconds: number
  ) => void | Promise<void>
): AsyncGenerator<T> {
  const errors: unknown[] = [];
  let previousProvider: ProviderName | undefined;
  const configuredOverride = process.env.LLM_PROVIDER;

  if (configuredOverride && configuredOverride !== 'nvidia' && configuredOverride !== 'groq') {
    throw new Error(
      `Unsupported LLM_PROVIDER "${configuredOverride}". Expected "nvidia" or "groq".`
    );
  }

  const forcedProvider = configuredOverride as ProviderName | undefined;
  const providerOrder: ProviderName[] = forcedProvider
    ? [forcedProvider]
    : (['nvidia', 'groq'] as ProviderName[]).filter(hasKey);

  for (const [index, name] of providerOrder.entries()) {
    if (!hasKey(name)) continue;

    const startedAt = performance.now();
    let emitted = false;
    let failoverRecorded = false;

    try {
      const stream = await fn(name);
      for await (const chunk of stream) {
        emitted = true;
        if (previousProvider && onFailover && !failoverRecorded) {
          failoverRecorded = true;
          try {
            void Promise.resolve(onFailover(previousProvider, name)).catch(() => undefined);
          } catch {
            // Telemetry must not change the stream result or retry behavior.
          }
        }
        yield chunk;
      }

      if (previousProvider && onFailover && !failoverRecorded) {
        try {
          void Promise.resolve(onFailover(previousProvider, name)).catch(() => undefined);
        } catch {
          // Telemetry must not change the stream result or retry behavior.
        }
      }
      return;
    } catch (error) {
      if (emitted) {
        throw new Error(`LLM provider ${name} stream failed after output`, { cause: error });
      }

      errors.push({ provider: name, error });
      previousProvider = name;
    } finally {
      if (onAttempt) {
        try {
          void Promise.resolve(
            onAttempt(name, index > 0, (performance.now() - startedAt) / 1_000)
          ).catch(() => undefined);
        } catch {
          // Telemetry must not change the stream result or retry behavior.
        }
      }
    }
  }

  if (errors.length === 0) {
    throw new Error('No LLM provider configured. Set NVIDIA_API_KEY or GROQ_API_KEY in .env');
  }

  const summary = errors
    .map(
      (entry) =>
        `${(entry as { provider: string }).provider}: ${(entry as { error: unknown }).error instanceof Error ? (entry as { error: Error }).error.message : String((entry as { error: unknown }).error)}`
    )
    .join(' | ');
  throw new Error(`All LLM providers failed. ${summary}`);
}

function hasKey(name: ProviderName): boolean {
  if (name === 'nvidia') return Boolean(process.env.NVIDIA_API_KEY);
  return Boolean(process.env.GROQ_API_KEY);
}
