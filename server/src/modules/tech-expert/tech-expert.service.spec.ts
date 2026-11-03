import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { TechExpertService } from './tech-expert.service.js';
import { TechAnswer } from './tech-expert.types.js';
import { MetricsService } from '../metrics/metrics.service.js';

// Setup mock behavior for Mastra Agent
const mockAnswer: TechAnswer = {
  topic: 'REST vs GraphQL',
  summary: 'REST uses resource URLs while GraphQL allows clients to define response structure.',
  keyPoints: ['REST uses GET/POST verbs', 'GraphQL uses query syntax'],
  examples: ['GET /users', 'query { users { name } }'],
  relatedTopics: ['gRPC', 'WebSockets'],
};

const mockGenerate = vi.fn();

vi.mock('../../mastra/mastra.config.js', () => ({
  mastra: {
    getAgent: () => ({
      generate: mockGenerate,
    }),
  },
}));

describe('TechExpertService', () => {
  let service: TechExpertService;
  let metrics: MetricsService;

  beforeEach(() => {
    metrics = new MetricsService({
      incrementMetricCounter: vi.fn().mockResolvedValue(1),
      getMetricCounter: vi.fn().mockResolvedValue(1),
    } as never);
    service = new TechExpertService(metrics);
    vi.stubEnv('LLM_PROVIDER', '');
    vi.stubEnv('NVIDIA_API_KEY', 'nvidia-test-key');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('should successfully ask a question and return structured response', async () => {
    // Arrange
    const question = 'Explain REST vs GraphQL';
    mockGenerate.mockResolvedValue({
      object: mockAnswer,
      text: JSON.stringify(mockAnswer),
    });

    // Act
    const result = await service.askQuestion({ question });

    // Assert
    expect(mockGenerate).toHaveBeenCalledWith(question, expect.any(Object));
    expect(result).toEqual({
      data: {
        answer: mockAnswer,
        rawResponse: JSON.stringify(mockAnswer),
      },
      error: null,
      meta: {},
    });
  });

  it('should return error response when Mastra agent generate throws an error', async () => {
    // Arrange
    const question = 'Explain REST vs GraphQL';
    const errorMessage = 'API connection failure';
    mockGenerate.mockRejectedValue(new Error(errorMessage));

    // Act
    const result = await service.askQuestion({ question });

    // Assert
    expect(result).toEqual({
      data: null,
      error: `All LLM providers failed. nvidia: ${errorMessage} | groq: ${errorMessage}`,
      meta: {},
    });
  });

  it('retries with the fallback provider after the primary provider fails', async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error('NVIDIA unavailable'))
      .mockResolvedValueOnce({ object: mockAnswer, text: JSON.stringify(mockAnswer) });

    const result = await service.askQuestion({ question: 'Explain REST vs GraphQL' });

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(result.data?.answer).toEqual(mockAnswer);
    expect(result.error).toBeNull();
    expect(await metrics.getMetrics()).toContain(
      'mastra_provider_failovers_total{from="nvidia",to="groq"} 1'
    );
  });
});
