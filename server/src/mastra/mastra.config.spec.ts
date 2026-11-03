import { describe, expect, it } from 'vitest';
import { mastra } from './mastra.config.js';

describe('Mastra configuration', () => {
  it('registers the coding review agent', () => {
    expect(() => mastra.getAgent('codingReviewAgent')).not.toThrow();
  });

  it('registers the study coach agent', () => {
    expect(() => mastra.getAgent('studyCoachAgent')).not.toThrow();
  });
});
