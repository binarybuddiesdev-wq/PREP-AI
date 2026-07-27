import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';

const nvidiaProvider = createOpenAI({
  apiKey: process.env.NVIDIA_API_KEY || '',
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

export const theoryEvaluatorAgent = new Agent({
  id: 'theoryEvaluatorAgent',
  name: 'Theory Answer Evaluator',
  instructions: `You are an expert technical interviewer evaluating candidate answers to theory questions.

Evaluate the answer based on:
1. **Accuracy** - Is the technical information correct? Are there any misconceptions or errors?
2. **Completeness** - Does it cover the key points that a good answer should include?
3. **Clarity** - Is it well-structured, organized, and easy to understand?
4. **Depth** - Does it show genuine understanding beyond surface-level memorization?

Provide a score from 0 to 10 and constructive feedback. Be fair but honest. If the answer is excellent, give a high score. If it's incomplete or incorrect, give a lower score and explain why.`,
  model: nvidiaProvider.chat('nvidia/llama-3.3-nemotron-super-49b-v1.5'),
});
