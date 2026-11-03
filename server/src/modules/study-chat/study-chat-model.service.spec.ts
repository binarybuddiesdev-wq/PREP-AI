import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyChatModelService } from './study-chat-model.service.js';
import type { StudyChatPromptMessage } from './study-chat.types.js';

const { chatWithFailover, getModel } = vi.hoisted(() => ({
  chatWithFailover: vi.fn(),
  getModel: vi.fn((provider: string) => provider),
}));

vi.mock('@/mastra/providers.js', () => ({ chatWithFailover, getModel }));

describe('StudyChatModelService', () => {
  let agent: { generate: ReturnType<typeof vi.fn> };
  let metrics: { recordProviderFailover: ReturnType<typeof vi.fn> };
  let tokenBudget: { reserve: ReturnType<typeof vi.fn>; settle: ReturnType<typeof vi.fn> };
  let logger: { warn: ReturnType<typeof vi.fn> };
  let service: StudyChatModelService;

  beforeEach(() => {
    agent = {
      generate: vi.fn().mockResolvedValue({
        text: ' Study coach answer ',
        usage: Promise.resolve({ totalTokens: 111 }),
      }),
    };
    metrics = { recordProviderFailover: vi.fn() };
    tokenBudget = {
      reserve: vi.fn().mockResolvedValue({
        allowed: true,
        quotaKey: 'quota:user-1:2026-11-03:ai_tokens',
        reservationKey: 'reservation-1',
        ttlSeconds: 3600,
      }),
      settle: vi.fn().mockResolvedValue(undefined),
    };
    logger = { warn: vi.fn() };
    chatWithFailover.mockImplementation(async (call, onFailover) => {
      const result = await call('groq');
      await onFailover('nvidia', 'groq');
      return result;
    });
    service = new StudyChatModelService(
      agent as never,
      metrics as never,
      tokenBudget as never,
      logger as never
    );
  });

  it('uses Mastra with provider failover and records a fallback metric', async () => {
    const messages: StudyChatPromptMessage[] = [
      { role: 'user', content: 'Explain queues' },
      { role: 'assistant', content: 'A queue is first-in-first-out.' },
    ];

    await expect(service.generateReply('clerk-user-1', messages)).resolves.toBe(
      'Study coach answer'
    );

    expect(chatWithFailover).toHaveBeenCalledOnce();
    expect(agent.generate).toHaveBeenCalledWith(messages, {
      model: 'groq',
      modelSettings: { maxOutputTokens: 1_500 },
    });
    expect(metrics.recordProviderFailover).toHaveBeenCalledWith('nvidia', 'groq');
    expect(tokenBudget.reserve).toHaveBeenCalledWith(
      'clerk-user-1',
      expect.any(String),
      expect.any(Number)
    );
    expect(tokenBudget.settle).toHaveBeenCalledWith(
      expect.objectContaining({ reservationKey: 'reservation-1' }),
      111
    );
  });

  it('fails when the model returns an empty response', async () => {
    agent.generate.mockResolvedValueOnce({ text: '  ' });

    await expect(
      service.generateReply('clerk-user-1', [{ role: 'user', content: 'Explain queues' }])
    ).rejects.toThrow('Study coach returned an empty reply');
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("does not call the model when the user's daily token budget is exhausted", async () => {
    tokenBudget.reserve.mockResolvedValueOnce({
      allowed: false,
      count: 400_000,
      quotaKey: 'quota:user-1:2026-11-03:ai_tokens',
      reservationKey: 'reservation-1',
      ttlSeconds: 3600,
    });

    await expect(
      service.generateReply('clerk-user-1', [{ role: 'user', content: 'Explain queues' }])
    ).rejects.toThrow('Daily AI token budget reached');
    expect(agent.generate).not.toHaveBeenCalled();
    expect(tokenBudget.settle).not.toHaveBeenCalled();
  });

  it('settles from prompt and completion token counts when no total is reported', async () => {
    agent.generate.mockResolvedValueOnce({
      text: 'answer',
      usage: Promise.resolve({ promptTokens: 7, completionTokens: 5 }),
    });

    await service.generateReply('clerk-user-1', [{ role: 'user', content: 'Explain queues' }]);

    expect(tokenBudget.settle).toHaveBeenCalledWith(expect.any(Object), 12);
  });

  it('keeps the reserved allowance when provider usage cannot be read', async () => {
    agent.generate.mockResolvedValueOnce({
      text: 'answer',
      usage: Promise.reject(new Error('usage unavailable')),
    });

    await service.generateReply('clerk-user-1', [{ role: 'user', content: 'Explain queues' }]);

    expect(tokenBudget.settle).toHaveBeenCalledWith(expect.any(Object), 1_770);
  });

  it('keeps the reserved allowance when usage contains no usable token counts', async () => {
    agent.generate.mockResolvedValueOnce({ text: 'answer', usage: Promise.resolve({}) });

    await service.generateReply('clerk-user-1', [{ role: 'user', content: 'Explain queues' }]);

    expect(tokenBudget.settle).toHaveBeenCalledWith(expect.any(Object), 1_770);
  });

  it('reserves enough space for structured message content', async () => {
    const message: StudyChatPromptMessage = {
      role: 'user',
      content: [{ type: 'text', text: 'Explain queues' }],
    };

    await service.generateReply('clerk-user-1', [message]);

    expect(tokenBudget.reserve).toHaveBeenCalledWith('clerk-user-1', expect.any(String), 1_797);
  });

  it('keeps the reserved allowance and warns when settling fails', async () => {
    tokenBudget.settle.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(
      service.generateReply('clerk-user-1', [{ role: 'user', content: 'Explain queues' }])
    ).resolves.toBe('Study coach answer');
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
