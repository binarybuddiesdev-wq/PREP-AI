import { Mastra } from '@mastra/core';
import { techExpertAgent } from './agents/tech-expert-agent.js';

export const mastra = new Mastra({
    agents: {
        techExpertAgent
    },
});
