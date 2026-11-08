import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { mastra } from '../../mastra/mastra.config.js';
import { chatWithFailover, getModel } from '../../mastra/providers.js';
import { MetricsService } from '../metrics/metrics.service.js';
import {
  codingBankProblemSchema,
  createQuestionContentFingerprint,
  theoryBankQuestionSchema,
  validateCodingProblemBatch,
  validateTheoryQuestionBatch,
} from './question-bank-content.js';
import {
  getQuestionBankPolicy,
  type TCodingDifficulty,
  type TTheoryDifficulty,
} from './question-bank.policy.js';

export interface ITheoryGenerationRequest {
  topicSlug: string;
  topicName: string;
  difficulty: TTheoryDifficulty;
  count: number;
  existingPrompts: string[];
  existingConceptFingerprints?: ReadonlySet<string>;
}

export interface ICodingGenerationRequest {
  topic: string;
  difficulty: TCodingDifficulty;
  count: number;
  existingPrompts: string[];
  existingSlugs: string[];
  existingConceptFingerprints: ReadonlySet<string>;
  existingQuestionFingerprints?: ReadonlySet<string>;
}

@Injectable()
export class QuestionBankGeneratorService {
  constructor(private readonly metrics: MetricsService) {}

  async generateTheory(input: ITheoryGenerationRequest) {
    this.assertCount(input.count, 'theory');
    const schema = z.object({ questions: z.array(theoryBankQuestionSchema).length(input.count) });
    const prompt = `Create ${input.count} original scenario-based interview questions for the ${input.topicName} topic (${input.topicSlug}) at ${input.difficulty} difficulty.
Every question must describe a realistic situation, ask the learner to make or explain a decision, and include a concise technically correct reference answer. Do not write definition-only questions. Vary the engineering context and learning objective. Keep each learningObjective to at most 100 characters and each scenarioKey to at most 100 characters. Keep every question distinct from all existing prompts below, including near-paraphrases. Return the requested topic slug and difficulty on every item.

<existing_prompts_json>
${JSON.stringify(input.existingPrompts.slice(-100))}
</existing_prompts_json>`;
    const response = await this.generateStructured(prompt, schema, input.count, 'theory');
    const output = schema.safeParse(response.object);
    if (!output.success) throw this.structuredOutputError('Theory', output.error);
    return validateTheoryQuestionBatch(output.data.questions, {
      topicSlug: input.topicSlug,
      difficulty: input.difficulty,
      count: input.count,
      existingFingerprints: new Set(input.existingPrompts.map(createQuestionContentFingerprint)),
      existingConceptFingerprints: input.existingConceptFingerprints,
    });
  }

  async generateCoding(input: ICodingGenerationRequest) {
    this.assertCount(input.count, 'coding');
    const schema = z.object({ problems: z.array(codingBankProblemSchema).length(input.count) });
    const prompt = `Create ${input.count} original, practical coding interview problems for the ${input.topic} topic at ${input.difficulty} difficulty.
Each problem must be grounded in a realistic situation and require an algorithmic solution relevant to the topic. Keep each learningObjective to at most 100 characters and each scenarioKey to at most 100 characters. Include at least two examples with correct outputs and explanations, constraints, and matching JavaScript, TypeScript, and Python starter functions named solution. JavaScript and TypeScript starters must begin with function solution( and Python starters with def solution(. Examples.input is the positional argument list passed to solution(...input); when the function accepts one array, wrap that array as the first input value (for example, [[1, 2, 3]]). Keep each example shape consistent with the function signature in all three languages. Each reference solution must be a complete, executable implementation that passes every example exactly. Check each implementation against every example before returning it. Python solutions must use multiline syntax with one statement per line. Put the function body on indented lines after the def line; never put a statement after the colon on the same line, and never compress multiple statements with semicolons. Python must use valid syntax and indentation; never return pseudocode, placeholders, or compressed invalid control-flow statements. Reference solutions are only used by the worker to verify examples and must not be stored or exposed to learners. Avoid every existing slug and scenario listed below. Do not paraphrase an existing problem.

<existing_problem_summaries_json>
${JSON.stringify({ prompts: input.existingPrompts.slice(-100), slugs: input.existingSlugs.slice(-500) })}
</existing_problem_summaries_json>`;
    const response = await this.generateStructured(prompt, schema, input.count, 'coding');
    const output = schema.safeParse(response.object);
    if (!output.success) throw this.structuredOutputError('Coding problem', output.error);
    return validateCodingProblemBatch(output.data.problems, {
      topic: input.topic,
      difficulty: input.difficulty,
      count: input.count,
      existingConceptFingerprints: input.existingConceptFingerprints,
      existingQuestionFingerprints: new Set([
        ...input.existingPrompts.map(createQuestionContentFingerprint),
        ...(input.existingQuestionFingerprints ?? []),
      ]),
    });
  }

  private async generateStructured<TSchema extends z.ZodType>(
    prompt: string,
    schema: TSchema,
    count: number,
    kind: 'theory' | 'coding'
  ): Promise<{ object: unknown }> {
    const maxOutputTokens = Math.min(8_192, count * (kind === 'theory' ? 500 : 2_500));
    const agent = mastra.getAgent('questionBankAgent');
    return chatWithFailover(
      (provider) =>
        agent.generate(prompt, {
          model: getModel(provider),
          modelSettings: { maxOutputTokens },
          structuredOutput: { schema, jsonPromptInjection: true },
        }),
      (from, to) => this.metrics.recordProviderFailover(from, to),
      (provider, fallback, duration) =>
        this.metrics.recordMastraAgentDuration('question_bank', provider, fallback, duration)
    ) as Promise<{ object: unknown }>;
  }

  private assertCount(count: number, kind: 'theory' | 'coding'): void {
    const maximum = getQuestionBankPolicy(kind).batchSize;
    if (!Number.isInteger(count) || count < 1 || count > maximum) {
      throw new Error(`Question bank ${kind} batch size must be between 1 and ${maximum}`);
    }
  }

  private structuredOutputError(kind: string, error: z.ZodError): Error {
    const details = error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    return new Error(`${kind} generator returned invalid structured output: ${details}`);
  }
}
