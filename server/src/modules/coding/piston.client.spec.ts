import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PistonClient } from './piston.client.js';

describe('PistonClient', () => {
  let client: PistonClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  const config = { get: vi.fn() };
  const examples = [
    { input: [[2, 7, 11, 15], 9], output: [0, 1], explanation: 'The first pair sums to 9.' },
    { input: [[3, 2, 4], 6], output: [1, 2] },
  ];

  const pistonSuccess = (stdout: string) => ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      language: 'javascript',
      version: '22.0.0',
      run: { stdout, stderr: '', code: 0, signal: null, output: stdout },
    }),
  });

  beforeEach(() => {
    config.get.mockReset();
    config.get.mockReturnValue('http://127.0.0.1:2000');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new PistonClient(config as unknown as ConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['javascript', 'javascript'],
    ['typescript', 'typescript'],
    ['python', 'python'],
  ])('runs %s through the allowlisted Piston runtime', async (language, pistonLanguage) => {
    fetchMock
      .mockResolvedValueOnce(pistonSuccess('[0,1]\n'))
      .mockResolvedValueOnce(pistonSuccess('[1,2]\n'));

    const result = await client.execute(
      'function solution(nums, target) { return [0, 1]; }',
      language as 'javascript' | 'typescript' | 'python',
      examples
    );

    expect(result.status).toBe('accepted');
    expect(result.testCasesPassed).toBe(2);
    expect(result.testCasesTotal).toBe(2);
    expect(result.testCases.every((testCase: { passed: boolean }) => testCase.passed)).toBe(true);
    expect(result.runtime).toBeNull();
    expect(result.memoryUsage).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstRequest = fetchMock.mock.calls[0];
    expect(firstRequest[0]).toBe('http://127.0.0.1:2000/api/v2/execute');
    const requestBody = JSON.parse(firstRequest[1].body as string);
    expect(requestBody.language).toBe(pistonLanguage);
    expect(requestBody.version).toBe('*');
    expect(requestBody.files).toHaveLength(1);
    expect(requestBody.files[0].content).toContain('function solution(nums, target)');
    expect(requestBody.files[0].content).toContain(
      language === 'python' ? 'json.dumps' : 'JSON.stringify'
    );
    if (language === 'typescript') {
      expect(requestBody.files[0].content.startsWith('/// <reference lib="es2015" />')).toBe(true);
      expect(requestBody.files[0].content).toContain(
        '(solution as (...args: unknown[]) => unknown)(...__prepai_args)'
      );
    }
    expect(requestBody.run_timeout).toBeGreaterThan(0);
    expect(requestBody.run_timeout).toBeLessThanOrEqual(3000);
    expect(requestBody.compile_timeout).toBeGreaterThan(0);
    expect(requestBody.compile_timeout).toBeLessThanOrEqual(10000);
    expect(requestBody.run_memory_limit).toBeGreaterThan(0);
    expect(requestBody.compile_memory_limit).toBeGreaterThan(0);
    expect(requestBody).not.toHaveProperty('args');
    expect(requestBody).not.toHaveProperty('run_timeout', 999_999);
  });

  it('builds a Python harness without accepting client-controlled harness options', async () => {
    fetchMock
      .mockResolvedValueOnce(pistonSuccess('[0,1]\n'))
      .mockResolvedValueOnce(pistonSuccess('[1,2]\n'));

    await client.execute('def solution(nums, target): return [0, 1]', 'python', examples);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.language).toBe('python');
    expect(requestBody.files[0].name).toBe('main.py');
    expect(requestBody.files[0].content).toContain('import json');
    expect(requestBody.files[0].content).toContain('solution(*');
    expect(requestBody.stdin).toBeUndefined();
  });

  it('reports a wrong answer when output differs from the expected JSON value', async () => {
    fetchMock
      .mockResolvedValueOnce(pistonSuccess('[0,1]\n'))
      .mockResolvedValueOnce(pistonSuccess('[0,2]\n'));

    const result = await client.execute(
      'function solution() { return [0, 1]; }',
      'javascript',
      examples
    );

    expect(result.status).toBe('wrong_answer');
    expect(result.testCasesPassed).toBe(1);
    expect(result.testCases[1]).toEqual(
      expect.objectContaining({ expected: [1, 2], got: [0, 2], passed: false })
    );
  });

  it.each([
    ['missing run output', { run: undefined }, 'Code did not produce a valid result'],
    [
      'nonzero exit code',
      { run: { code: 1, signal: null, stderr: 'runtime error' } },
      'runtime error',
    ],
    ['terminated run', { run: { code: 0, signal: 'SIGTERM', output: 'terminated' } }, 'terminated'],
    [
      'failed compilation',
      { compile: { code: 1, signal: null, stderr: 'compile error' } },
      'compile error',
    ],
    [
      'terminated compilation',
      { compile: { code: 0, signal: 'SIGTERM', output: 'compile terminated' } },
      'compile terminated',
    ],
  ])('reports %s as an execution error', async (_name, stages, output) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(stages),
    });

    await expect(
      client.execute('function solution() {}', 'javascript', [examples[0]])
    ).resolves.toMatchObject({ status: 'error', testCases: [{ passed: false, got: output }] });
  });

  it('finds the last structured result after non-JSON stdout lines', async () => {
    fetchMock.mockResolvedValueOnce(pistonSuccess('debug output\n__PREPAI_RESULT__[0,1]\n'));

    await expect(
      client.execute('function solution() { return [0, 1]; }', 'javascript', [examples[0]])
    ).resolves.toMatchObject({ status: 'accepted', testCasesPassed: 1 });
  });

  it.each([null, 'invalid response'])('rejects a non-object Piston response: %s', async (body) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(body),
    });

    await expect(
      client.execute('function solution() {}', 'javascript', [examples[0]])
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports compilation or runtime failure without marking the case accepted', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        language: 'typescript',
        version: '5.0.0',
        compile: { code: 1, signal: null, stderr: 'compile error', output: 'compile error' },
      }),
    });

    const result = await client.execute('invalid syntax', 'typescript', [examples[0]]);

    expect(result.status).toBe('error');
    expect(result.testCasesPassed).toBe(0);
    expect(result.testCases[0].passed).toBe(false);
    expect(result.testCases[0].got).toContain('compile error');
  });

  it('rejects invalid languages, empty cases, and oversized source before making a request', async () => {
    await expect(client.execute('print(1)', 'bash' as 'javascript', examples)).rejects.toThrow();
    await expect(client.execute('function solution() {}', 'javascript', [])).rejects.toThrow();
    await expect(client.execute('x'.repeat(32_001), 'javascript', [examples[0]])).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps test-case count and surfaced output', async () => {
    const manyExamples = Array.from({ length: 21 }, () => examples[0]);
    await expect(
      client.execute('function solution() { return 1; }', 'javascript', manyExamples)
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(pistonSuccess('x'.repeat(20_000)));
    const result = await client.execute('function solution() { return 1; }', 'javascript', [
      examples[0],
    ]);
    expect(String(result.testCases[0].got).length).toBeLessThanOrEqual(16_384);
  });

  it('maps Piston HTTP, timeout, and malformed JSON failures to ServiceUnavailableException', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: vi.fn() });
    await expect(
      client.execute('function solution() {}', 'javascript', [examples[0]])
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    await expect(
      client.execute('function solution() {}', 'javascript', [examples[0]])
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
    });
    await expect(
      client.execute('function solution() {}', 'javascript', [examples[0]])
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('uses one deadline for the whole example batch', async () => {
    fetchMock.mockResolvedValue(pistonSuccess('[0,1]\n'));
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValueOnce(1_000).mockReturnValueOnce(1_000).mockReturnValueOnce(16_001);

    await expect(
      client.execute('function solution() { return [0, 1]; }', 'javascript', examples)
    ).rejects.toThrow('Code execution timed out');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('disables production execution unless explicitly enabled', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'PISTON_URL') return 'http://127.0.0.1:2000';
      if (key === 'NODE_ENV') return 'production';
      if (key === 'PISTON_EXECUTION_ENABLED') return undefined;
      return fallback;
    });
    client = new PistonClient(config as unknown as ConfigService);

    await expect(
      client.execute('function solution() { return [0, 1]; }', 'javascript', [examples[0]])
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();

    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'PISTON_URL') return 'http://127.0.0.1:2000';
      if (key === 'NODE_ENV') return 'production';
      if (key === 'PISTON_EXECUTION_ENABLED') return true;
      return fallback;
    });
    client = new PistonClient(config as unknown as ConfigService);
    fetchMock.mockResolvedValue(pistonSuccess('[0,1]\n'));

    await expect(
      client.execute('function solution() { return [0, 1]; }', 'javascript', [examples[0]])
    ).resolves.toMatchObject({ status: 'accepted' });
  });

  it('keeps execution enabled in development by default', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'PISTON_URL') return 'http://127.0.0.1:2000';
      if (key === 'NODE_ENV') return 'development';
      if (key === 'PISTON_EXECUTION_ENABLED') return undefined;
      return fallback;
    });
    client = new PistonClient(config as unknown as ConfigService);
    fetchMock.mockResolvedValue(pistonSuccess('[0,1]\n'));

    await expect(
      client.execute('function solution() { return [0, 1]; }', 'javascript', [examples[0]])
    ).resolves.toMatchObject({ status: 'accepted' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
