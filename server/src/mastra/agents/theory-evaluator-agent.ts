import { Agent } from '@mastra/core/agent';
import { getModel } from '../providers.js';
import { currentTheoryEvaluatorPrompt } from './theory-evaluator-prompts.js';

export { THEORY_EVALUATOR_PROMPT_VERSION } from './theory-evaluator-prompts.js';

export const theoryEvaluatorAgent = new Agent({
  id: 'theoryEvaluatorAgent',
  name: 'Theory Answer Evaluator',
  instructions: currentTheoryEvaluatorPrompt.instructions,
  model: getModel(),
});
