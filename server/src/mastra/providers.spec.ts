import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chatWithFailover,
  defaultModel,
  getModel,
  pickProvider,
  streamWithFailover,
} from './providers.js';

async function* chunks(...values: string[]) {
  yield* values;
}

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

  it('records each provider attempt and marks only retry attempts as fallback', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const attempts: Array<[string, boolean, number]> = [];

    const result = await chatWithFailover(
      async (provider) => {
        if (provider === 'nvidia') throw new Error('NVIDIA unavailable');
        return 'groq response';
      },
      undefined,
      (provider, fallback, duration) => {
        attempts.push([provider, fallback, duration]);
      }
    );

    expect(result).toBe('groq response');
    expect(attempts.map(([provider, fallback]) => [provider, fallback])).toEqual([
      ['nvidia', false],
      ['groq', true],
    ]);
    expect(attempts.every(([, , duration]) => Number.isFinite(duration) && duration >= 0)).toBe(
      true
    );
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

describe('defaultModel', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses a currently available NVIDIA NIM model by default', () => {
    vi.stubEnv('NVIDIA_MODEL', '');

    expect(defaultModel.nvidia()).toBe('nvidia/nemotron-3.5-bolt-e4b');
  });
});

describe('streamWithFailover', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('retries on the fallback provider when the first provider fails before output', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const calls: string[] = [];
    const failovers: string[] = [];
    const output: string[] = [];

    for await (const chunk of streamWithFailover<string>(
      async (provider) => {
        calls.push(provider);
        if (provider === 'nvidia') throw new Error('NVIDIA unavailable');
        return chunks('fallback');
      },
      (from, to) => {
        failovers.push(`${from}:${to}`);
      }
    )) {
      output.push(chunk);
    }

    expect(calls).toEqual(['nvidia', 'groq']);
    expect(failovers).toEqual(['nvidia:groq']);
    expect(output).toEqual(['fallback']);
  });

  it('does not retry after yielding output from a provider', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const calls: string[] = [];
    const output: string[] = [];

    await expect(async () => {
      for await (const chunk of streamWithFailover(async (provider) => {
        calls.push(provider);
        return (async function* () {
          yield 'partial';
          throw new Error('connection lost');
        })();
      })) {
        output.push(chunk);
      }
    }).rejects.toThrow('failed after output');

    expect(calls).toEqual(['nvidia']);
    expect(output).toEqual(['partial']);
  });

  it('fails clearly when no provider key is configured', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');

    await expect(async () => {
      for await (const _chunk of streamWithFailover(async () => chunks('unused'))) {
        // consume the stream to trigger provider selection
      }
    }).rejects.toThrow('No LLM provider configured');
  });

  it('rejects an unsupported provider override before opening a stream', async () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    const openStream = vi.fn(async () => chunks('unused'));

    await expect(async () => {
      for await (const _chunk of streamWithFailover(openStream)) {
        // consume the stream to trigger provider validation
      }
    }).rejects.toThrow('Unsupported LLM_PROVIDER');
    expect(openStream).not.toHaveBeenCalled();
  });

  it('records an empty fallback and keeps telemetry failures out of the stream result', async () => {
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const failover = vi.fn(() => {
      throw new Error('telemetry failed');
    });
    const attempt = vi.fn(() => {
      throw new Error('telemetry failed');
    });
    const output: string[] = [];

    for await (const chunk of streamWithFailover<string>(
      async (provider) => {
        if (provider === 'nvidia') throw new Error('NVIDIA unavailable');
        return chunks();
      },
      failover,
      attempt
    )) {
      output.push(chunk);
    }

    expect(output).toEqual([]);
    expect(failover).toHaveBeenCalledWith('nvidia', 'groq');
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
