import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechExpertService } from './tech-expert.service.js';
import { TechAnswer } from './tech-expert.types.js';

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

  beforeEach(() => {
    service = new TechExpertService();
    vi.clearAllMocks();
  });

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
      error: errorMessage,
      meta: {},
    });
  });
});
