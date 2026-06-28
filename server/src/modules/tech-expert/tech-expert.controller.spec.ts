import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechExpertController } from './tech-expert.controller.js';
import { TechExpertService } from './tech-expert.service.js';
import { ITechExpertResponse } from './tech-expert.types.js';

describe('TechExpertController', () => {
  let controller: TechExpertController;
  let mockService: TechExpertService;

  beforeEach(() => {
    mockService = {
      askQuestion: vi.fn(),
    } as unknown as TechExpertService;

    controller = new TechExpertController(mockService);
  });

  it('should forward request body to the service and return the response', async () => {
    // Arrange
    const body = { question: 'Explain REST vs GraphQL' };
    const expectedResponse: ITechExpertResponse = {
      data: {
        answer: {
          topic: 'REST vs GraphQL',
          summary: 'Comparison of API architectural styles.',
          keyPoints: [],
          examples: [],
          relatedTopics: [],
        },
        rawResponse: '{}',
      },
      error: null,
      meta: {},
    };

    vi.mocked(mockService.askQuestion).mockResolvedValue(expectedResponse);

    // Act
    const result = await controller.ask(body);

    // Assert
    expect(mockService.askQuestion).toHaveBeenCalledWith(body);
    expect(result).toEqual(expectedResponse);
  });
});
