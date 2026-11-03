import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { performance } from 'node:perf_hooks';
import { MetricsService } from '@/modules/metrics/metrics.service.js';

export const CODING_MAX_SOURCE_LENGTH = 32_000;
export const CODING_MAX_TEST_CASES = 20;
export const CODING_MAX_OUTPUT_LENGTH = 16_384;
const CODING_COMPILE_TIMEOUT_MS = 10_000;
const CODING_RUN_TIMEOUT_MS = 3_000;
const CODING_REQUEST_TIMEOUT_MS = 15_000;
const CODING_MEMORY_LIMIT_BYTES = 256 * 1024 * 1024;
const PISTON_MAX_RESPONSE_BYTES = 512 * 1024;
const RESULT_LINE_PREFIX = '__PREPAI_RESULT__';

export const codingLanguageSchema = z.enum(['javascript', 'typescript', 'python']);
export type TCodingLanguage = z.infer<typeof codingLanguageSchema>;

export const codingExamplesSchema = z
  .array(
    z.object({
      input: z.array(z.unknown()),
      output: z.unknown(),
      explanation: z.string().optional(),
    })
  )
  .min(1)
  .max(CODING_MAX_TEST_CASES);

export type TCodingExample = z.infer<typeof codingExamplesSchema>[number];

export interface ICodingTestCaseResult {
  input: unknown[];
  expected: unknown;
  got: unknown;
  passed: boolean;
}

export interface ICodingExecutionResult {
  status: 'accepted' | 'wrong_answer' | 'error';
  testCasesPassed: number;
  testCasesTotal: number;
  testCases: ICodingTestCaseResult[];
  runtime: null;
  memoryUsage: null;
}

interface IPistonStage {
  stdout?: unknown;
  stderr?: unknown;
  output?: unknown;
  code?: unknown;
  signal?: unknown;
}

interface IPistonResponse {
  compile?: IPistonStage;
  run?: IPistonStage;
}

@Injectable()
export class PistonClient {
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService
  ) {
    this.baseUrl = config.get<string>('PISTON_URL', 'http://127.0.0.1:2000').replace(/\/+$/, '');
  }

  async execute(
    code: string,
    language: TCodingLanguage,
    examplesInput: unknown
  ): Promise<ICodingExecutionResult> {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const executionEnabled = this.config.get<boolean>('PISTON_EXECUTION_ENABLED');
    if (nodeEnv === 'production' && executionEnabled !== true) {
      throw new ServiceUnavailableException('Code execution is disabled in this environment');
    }
    const parsedLanguage = codingLanguageSchema.safeParse(language);
    if (!parsedLanguage.success) throw new BadRequestException('Unsupported coding language');
    if (typeof code !== 'string' || code.length === 0 || code.length > CODING_MAX_SOURCE_LENGTH) {
      throw new BadRequestException('Code must be between 1 and 32000 characters');
    }

    const parsedExamples = codingExamplesSchema.safeParse(examplesInput);
    if (!parsedExamples.success) {
      throw new BadRequestException('Problem examples are not valid executable test cases');
    }

    const startedAt = performance.now();
    let verdict: ICodingExecutionResult['status'] = 'error';
    try {
      const testCases: ICodingTestCaseResult[] = [];
      let hasExecutionError = false;
      const deadline = Date.now() + CODING_REQUEST_TIMEOUT_MS;
      for (const example of parsedExamples.data) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          throw new ServiceUnavailableException('Code execution timed out');
        }
        const { result, isError } = await this.executeExample(
          code,
          parsedLanguage.data,
          example,
          remainingMs
        );
        testCases.push(result);
        hasExecutionError ||= isError;
        if (isError) break;
      }

      const testCasesPassed = testCases.filter((testCase) => testCase.passed).length;
      const testCasesTotal = parsedExamples.data.length;
      const result: ICodingExecutionResult = {
        status: hasExecutionError
          ? 'error'
          : testCasesPassed === testCasesTotal
            ? 'accepted'
            : 'wrong_answer',
        testCasesPassed,
        testCasesTotal,
        testCases,
        runtime: null,
        memoryUsage: null,
      };
      verdict = result.status;
      return result;
    } finally {
      this.metrics.recordPistonExecutionDuration(
        parsedLanguage.data,
        verdict,
        Math.max(0, (performance.now() - startedAt) / 1000)
      );
    }
  }

  private async executeExample(
    code: string,
    language: TCodingLanguage,
    example: TCodingExample,
    remainingMs: number
  ): Promise<{ result: ICodingTestCaseResult; isError: boolean }> {
    const { fileName, content } = this.buildHarness(code, language, example.input);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v2/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(Math.min(CODING_REQUEST_TIMEOUT_MS, remainingMs)),
        body: JSON.stringify({
          language,
          version: '*',
          files: [{ name: fileName, content }],
          compile_timeout: CODING_COMPILE_TIMEOUT_MS,
          compile_cpu_time: CODING_COMPILE_TIMEOUT_MS,
          run_timeout: CODING_RUN_TIMEOUT_MS,
          run_cpu_time: CODING_RUN_TIMEOUT_MS,
          compile_memory_limit: CODING_MEMORY_LIMIT_BYTES,
          run_memory_limit: CODING_MEMORY_LIMIT_BYTES,
        }),
      });
    } catch (error: unknown) {
      throw new ServiceUnavailableException('Code execution service is temporarily unavailable', {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Code execution service is temporarily unavailable');
    }

    let result: IPistonResponse;
    try {
      result = await this.readPistonResponse(response);
    } catch (error: unknown) {
      throw new ServiceUnavailableException('Code execution service returned an invalid response', {
        cause: error,
      });
    }

    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new ServiceUnavailableException('Code execution service returned an invalid response');
    }

    const compile = result.compile;
    if (compile && (compile.code !== 0 || compile.signal)) {
      return { result: this.failedTestCase(example, this.stageOutput(compile)), isError: true };
    }

    const run = result.run;
    if (!run || (run.code !== 0 && run.code !== null) || run.signal) {
      return { result: this.failedTestCase(example, this.stageOutput(run)), isError: true };
    }

    const output = this.stageOutput(run, 'stdout');
    const actual = this.parseResult(output);
    if (!actual.valid) return { result: this.failedTestCase(example, actual.raw), isError: true };

    return {
      result: {
        input: example.input,
        expected: example.output,
        got: this.boundValue(actual.value),
        passed: isDeepStrictEqual(actual.value, example.output),
      },
      isError: false,
    };
  }

  private async readPistonResponse(response: Response): Promise<IPistonResponse> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > PISTON_MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new Error('Piston response exceeded the configured byte limit');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Piston response did not include a body');

    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > PISTON_MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error('Piston response exceeded the configured byte limit');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const responseBytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      responseBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(responseBytes)) as IPistonResponse;
  }

  private buildHarness(code: string, language: TCodingLanguage, args: unknown[]) {
    const argsJson = JSON.stringify(args);
    if (language === 'python') {
      return {
        fileName: 'main.py',
        content: `${code}\nimport json as __prepai_json\n__prepai_args = __prepai_json.loads(${JSON.stringify(argsJson)})\n__prepai_result = solution(*__prepai_args)\nprint('${RESULT_LINE_PREFIX}' + __prepai_json.dumps(__prepai_result, separators=(',', ':')))\n`,
      };
    }

    const fileName = language === 'typescript' ? 'main.ts' : 'main.js';
    const solutionCall =
      language === 'typescript'
        ? '(solution as (...args: unknown[]) => unknown)(...__prepai_args)'
        : 'solution(...__prepai_args)';
    const argsDeclaration =
      language === 'typescript'
        ? `const __prepai_args: unknown[] = ${argsJson};`
        : `const __prepai_args = ${argsJson};`;
    const sourcePrefix = language === 'typescript' ? '/// <reference lib="es2015" />\n' : '';
    return {
      fileName,
      content: `${sourcePrefix}${code}\n${argsDeclaration}\nconst __prepai_result = ${solutionCall};\nconsole.log('${RESULT_LINE_PREFIX}' + JSON.stringify(__prepai_result));\n`,
    };
  }

  private parseResult(
    output: string
  ): { valid: true; value: unknown } | { valid: false; raw: string } {
    const lines = output.split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].startsWith(RESULT_LINE_PREFIX)
        ? lines[index].slice(RESULT_LINE_PREFIX.length)
        : lines[index];
      try {
        return { valid: true, value: JSON.parse(line) as unknown };
      } catch {
        continue;
      }
    }
    return { valid: false, raw: output };
  }

  private stageOutput(stage: IPistonStage | undefined, field: 'stdout' | 'output' = 'output') {
    const value = stage?.[field] ?? stage?.output ?? stage?.stderr ?? stage?.stdout;
    return typeof value === 'string' ? value : '';
  }

  private failedTestCase(example: TCodingExample, output: string): ICodingTestCaseResult {
    return {
      input: example.input,
      expected: example.output,
      got: this.boundValue(output || 'Code did not produce a valid result'),
      passed: false,
    };
  }

  private boundValue(value: unknown): unknown {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (serialized && serialized.length > CODING_MAX_OUTPUT_LENGTH) {
      const suffix = '…[output truncated]';
      return `${serialized.slice(0, CODING_MAX_OUTPUT_LENGTH - suffix.length)}${suffix}`;
    }
    return value;
  }
}
