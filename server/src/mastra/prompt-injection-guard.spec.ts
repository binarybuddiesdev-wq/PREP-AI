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

import {
  createPromptInjectionGuard,
  estimatePromptInjectionGuardTokens,
  isPromptInjectionGuardFailure,
} from './prompt-injection-guard.js';

describe('createPromptInjectionGuard', () => {
  afterEach(() => vi.clearAllMocks());

  it('uses the selected provider and blocks detected input and detector failures', () => {
    const onDetection = vi.fn();

    const guard = createPromptInjectionGuard('groq', onDetection);

    expect(mocks.getModel).toHaveBeenCalledWith('groq');
    expect(mocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'groq' },
        strategy: 'block',
        errorStrategy: 'strict',
        threshold: 0.7,
        lastMessageOnly: true,
        onDetection,
        structuredOutputOptions: { jsonPromptInjection: true },
        instructions: expect.stringContaining('Return exactly one JSON object'),
      })
    );
    expect(guard).toMatchObject({ id: 'prompt-injection-detector' });
  });

  it('instructs the detector to return the structured object its schema requires', () => {
    createPromptInjectionGuard('nvidia');
    const options = mocks.constructor.mock.calls[0]?.[0] as {
      instructions?: string;
      structuredOutputOptions?: { jsonPromptInjection?: boolean };
    };

    expect(options.structuredOutputOptions).toEqual({ jsonPromptInjection: true });
    expect(options.instructions).toContain('Return exactly one JSON object');
    expect(options.instructions).toContain('Never return a bare array');
  });

  it('conservatively reserves UTF-8 input tokens and fixed detector overhead', () => {
    expect(estimatePromptInjectionGuardTokens('abcd')).toBe(513);
    expect(estimatePromptInjectionGuardTokens('😀😀')).toBe(514);
  });

  it('supports an optional callback and recognizes strict detector failures', () => {
    createPromptInjectionGuard('nvidia');
    expect(mocks.constructor).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'nvidia' },
        strategy: 'block',
        errorStrategy: 'strict',
        threshold: 0.7,
        lastMessageOnly: true,
        structuredOutputOptions: { jsonPromptInjection: true },
        instructions: expect.stringContaining('Return exactly one JSON object'),
      })
    );
    expect(isPromptInjectionGuardFailure(new Error('Prompt injection detection failed'))).toBe(
      true
    );
    expect(isPromptInjectionGuardFailure(new Error('provider unavailable'))).toBe(false);
  });
});
