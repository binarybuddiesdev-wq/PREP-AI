import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatWithFailover, pickProvider } from './providers.js';

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

    const result = await chatWithFailover(async (provider) => {
      attemptedProviders.push(provider);
      if (provider === 'nvidia') throw new Error('NVIDIA unavailable');
      return 'groq response';
    });

    expect(result).toBe('groq response');
    expect(attemptedProviders).toEqual(['nvidia', 'groq']);
  });
});
