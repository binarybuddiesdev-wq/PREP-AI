import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { mastra } from '../../mastra/mastra.config.js';
import { ITechExpertRequest, ITechExpertResponse, techAnswerSchema, TechAnswer } from './tech-expert.types.js';

@Injectable()
export class TechExpertService {
  private readonly logger = new Logger(TechExpertService.name);

  public async askQuestion(payload: ITechExpertRequest): Promise<ITechExpertResponse> {
    try {
      this.logger.log(`Question: "${payload.question}"`);

      const agent = mastra.getAgent('techExpertAgent');
      const fallback: TechAnswer = {
        topic: 'Technology',
        summary: 'Unable to parse structured response',
        keyPoints: [],
        examples: [],
        relatedTopics: [],
      };

      const response = await agent.generate(payload.question, {
        structuredOutput: {
          schema: techAnswerSchema,
          jsonPromptInjection: true,
          errorStrategy: 'fallback',
          fallbackValue: fallback,
        },
      });

      const answer = (response.object as TechAnswer) || fallback;

      return {
        data: {
          answer,
          rawResponse: response.text,
        },
        error: null,
        meta: {},
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

      return {
        data: null,
        error: errorMessage,
        meta: {},
      };
    }
  }
}
