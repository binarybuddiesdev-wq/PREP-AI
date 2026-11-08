import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionBankScheduler } from './question-bank.scheduler.js';
import { questionBankTopics } from './question-bank-catalog.js';

describe('QuestionBankScheduler', () => {
  const config = { get: vi.fn().mockReturnValue(true) };
  const replenishment = { request: vi.fn().mockResolvedValue(false) };
  const logger = { error: vi.fn() };
  let scheduler: QuestionBankScheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    config.get.mockReturnValue(true);
    scheduler = new QuestionBankScheduler(config as never, replenishment as never, logger as never);
  });

  it('checks every theory and coding difficulty bucket once per scan', async () => {
    await scheduler.scan();
    expect(replenishment.request).toHaveBeenCalledTimes(75);
    for (const topic of questionBankTopics) {
      const kind = topic.category === 'practice' ? 'theory' : 'coding';
      const topicName = kind === 'theory' ? topic.slug : topic.name;
      const difficulties =
        kind === 'theory' ? ['Junior', 'Mid', 'Senior'] : ['Easy', 'Medium', 'Hard'];
      for (const difficulty of difficulties) {
        expect(replenishment.request).toHaveBeenCalledWith({ kind, topic: topicName, difficulty });
      }
    }
  });

  it('does not scan while workers are disabled', async () => {
    config.get.mockReturnValue(false);
    await scheduler.scan();
    expect(replenishment.request).not.toHaveBeenCalled();
  });

  it('starts and clears its periodic catalog scan when enabled', async () => {
    await scheduler.onModuleInit();
    expect(replenishment.request).toHaveBeenCalledTimes(75);
    await scheduler.onModuleDestroy();
  });

  it('does not create a periodic timer when disabled', async () => {
    config.get.mockReturnValue(false);
    await scheduler.onModuleInit();
    await scheduler.onModuleDestroy();
    expect(replenishment.request).not.toHaveBeenCalled();
  });
});
