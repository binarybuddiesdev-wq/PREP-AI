import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getModel: vi.fn((provider: string) => ({ provider })),
  constructor: vi.fn(),
}));

vi.mock('./providers.js', () => ({ getModel: mocks.getModel }));
vi.mock('@mastra/core/processors', () => ({
  PromptInjectionDetector: class PromptInjectionDetectorMock {
    readonly id = 'prompt-injection-detector';
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
      mocks.constructor(options);
    }
  },
}));

import { createPromptInjectionGuard } from './prompt-injection-guard.js';

describe('createPromptInjectionGuard', () => {
  afterEach(() => vi.clearAllMocks());

  it('uses the selected provider and blocks detected input and detector failures', () => {
    const onDetection = vi.fn();

    const guard = createPromptInjectionGuard('groq', onDetection);

    expect(mocks.getModel).toHaveBeenCalledWith('groq');
    expect(mocks.constructor).toHaveBeenCalledWith({
      model: { provider: 'groq' },
      strategy: 'block',
      errorStrategy: 'strict',
      threshold: 0.7,
      lastMessageOnly: true,
      onDetection,
    });
    expect(guard).toMatchObject({ id: 'prompt-injection-detector' });
  });
});
