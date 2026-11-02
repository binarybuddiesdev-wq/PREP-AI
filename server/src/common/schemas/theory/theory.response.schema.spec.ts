import { describe, expect, it } from 'vitest';
import { theoryAnswerDataSchema } from './theory.response.schema.js';

describe('theoryAnswerDataSchema evaluation provenance', () => {
  it('documents nullable provider, model, and prompt version fields', () => {
    expect(theoryAnswerDataSchema.properties).toMatchObject({
      evaluationProvider: { type: 'string', enum: ['nvidia', 'groq'], nullable: true },
      evaluationModel: { type: 'string', nullable: true },
      evaluationPromptVersion: { type: 'string', nullable: true },
    });
  });
});
