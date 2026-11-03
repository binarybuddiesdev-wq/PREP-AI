import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatWithFailover, getModel, pickProvider } from './providers.js';

describe('chatWithFailover', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses only the explicitly selected provider', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const attemptedProviders: string[] = [];

    const result = await chatWithFailover(async (provider) => {
      attemptedProviders.push(provider);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(attemptedProviders).toEqual(['groq']);
  });

  it.each(['nvidia', 'groq'])('accepts %s as a forced provider', (provider) => {
    vi.stubEnv('LLM_PROVIDER', provider);

    expect(pickProvider()).toBe(provider);
  });

  it('rejects an unsupported forced provider', () => {
    vi.stubEnv('LLM_PROVIDER', 'unknown');

    expect(() => pickProvider()).toThrow('Unsupported LLM_PROVIDER');
  });

  it('prefers NVIDIA when both provider keys are configured', () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');

    expect(pickProvider()).toBe('nvidia');
  });

  it('selects Groq when NVIDIA has no key', () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');

    expect(pickProvider()).toBe('groq');
  });

  it('supports an explicit model override for controlled experiments', () => {
    expect(getModel('groq', 'openai/custom-baseline-model').modelId).toBe(
      'openai/custom-baseline-model'
    );
  });

  it('reports a failed provider when the provider throws a non-Error value', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', '');

    await expect(chatWithFailover(async () => Promise.reject('provider failure'))).rejects.toThrow(
      'All LLM providers failed. nvidia: provider failure'
    );
  });

  it('does not retry the explicitly forced provider after failure', async () => {
    vi.stubEnv('LLM_PROVIDER', 'groq');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const attemptedProviders: string[] = [];

    await expect(
      chatWithFailover(async (provider) => {
        attemptedProviders.push(provider);
        throw new Error('Groq unavailable');
      })
    ).rejects.toThrow('All LLM providers failed. groq: Groq unavailable');
    expect(attemptedProviders).toEqual(['groq']);
  });

  it('allows the app to initialize without an AI key but does not make a provider available', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');

    expect(pickProvider()).toBe('nvidia');
    await expect(chatWithFailover(async () => 'unreachable')).rejects.toThrow(
      'No LLM provider configured'
    );
  });

  it('tries the other configured provider after the primary fails', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const attemptedProviders: string[] = [];

    const failovers: Array<[string, string]> = [];
    const result = await chatWithFailover(
      async (provider) => {
        attemptedProviders.push(provider);
        if (provider === 'nvidia') throw new Error('NVIDIA unavailable');
        return 'groq response';
      },
      (from, to) => {
        failovers.push([from, to]);
      }
    );

    expect(result).toBe('groq response');
    expect(attemptedProviders).toEqual(['nvidia', 'groq']);
    expect(failovers).toEqual([['nvidia', 'groq']]);
  });

  it('does not report a failover when the fallback provider also fails', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const onFailover = vi.fn();

    await expect(
      chatWithFailover(async () => {
        throw new Error('provider unavailable');
      }, onFailover)
    ).rejects.toThrow('All LLM providers failed');

    expect(onFailover).not.toHaveBeenCalled();
  });

  it('does not let a telemetry callback failure affect a successful fallback', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');

    await expect(
      chatWithFailover(
        async (provider) => {
          if (provider === 'nvidia') throw new Error('NVIDIA unavailable');
          return 'groq response';
        },
        async () => {
          throw new Error('metrics unavailable');
        }
      )
    ).resolves.toBe('groq response');
  });
});
