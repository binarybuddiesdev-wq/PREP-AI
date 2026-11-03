import { Mastra } from '@mastra/core';
import { techExpertAgent } from './agents/tech-expert-agent.js';
import { theoryEvaluatorAgent } from './agents/theory-evaluator-agent.js';
import { pdfStudyAgent } from './agents/pdf-study-agent.js';
import { codingReviewAgent } from './agents/coding-review-agent.js';
import { studyCoachAgent } from './agents/study-coach-agent.js';

export const mastra = new Mastra({
  agents: {
    techExpertAgent,
    theoryEvaluatorAgent,
    pdfStudyAgent,
    codingReviewAgent,
    studyCoachAgent,
  },
});
