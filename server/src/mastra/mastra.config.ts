import { Mastra } from '@mastra/core';
import { techExpertAgent } from './agents/tech-expert-agent.js';
import { theoryEvaluatorAgent } from './agents/theory-evaluator-agent.js';

export const mastra = new Mastra({
    agents: {
        techExpertAgent,
        theoryEvaluatorAgent,
    },
});
