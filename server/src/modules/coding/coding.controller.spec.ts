import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingController } from './coding.controller.js';
import { CodingService } from './coding.service.js';
import { ClerkAuthGuard, RolesGuard } from '@/common/index.js';
const GUARDS_METADATA = '__guards__';
import { Reflector } from '@nestjs/core';
import type { ExecuteCodingDto } from './dto/coding.dto.js';

class MockAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

describe('CodingController', () => {
  it('requires Clerk authentication and role checks for coding routes', () => {
    expect(new Reflector().get(GUARDS_METADATA, CodingController)).toEqual([
      ClerkAuthGuard,
      RolesGuard,
    ]);
  });

  let controller: CodingController;
  let codingService: Record<string, ReturnType<typeof vi.fn>>;

  const problem = { id: 'problem_001', slug: 'two-sum' };
  const session = { id: 'session_001', userId: 'user_001', status: 'in_progress' };
  const execution = {
    id: 'execution_001',
    sessionId: 'session_001',
    operation: 'run',
    status: 'queued',
  };
  const history = { sessions: [session], total: 1, page: 1, limit: 20 };

  beforeEach(async () => {
    codingService = {
      listProblems: vi.fn(),
      getProblem: vi.fn(),
      startSession: vi.fn(),
      runCode: vi.fn(),
      submitSolution: vi.fn(),
      getExecution: vi.fn(),
      getSessionDetail: vi.fn(),
      completeSession: vi.fn(),
      getSessionHistory: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodingController],
      providers: [{ provide: CodingService, useValue: codingService }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(RolesGuard)
      .useClass(MockAuthGuard)
      .compile();

    controller = module.get<CodingController>(CodingController);
  });

  it('returns the standard message/data envelope for problem listing and detail', async () => {
    codingService.listProblems.mockResolvedValue([problem]);
    codingService.getProblem.mockResolvedValue(problem);

    const list = await controller.listProblems({ topic: 'Arrays', difficulty: 'Easy' });
    const detail = await controller.getProblem('two-sum');

    expect(list).toEqual({ message: expect.any(String), data: [problem] });
    expect(detail).toEqual({ message: expect.any(String), data: problem });
    expect(codingService.listProblems).toHaveBeenCalledWith({
      topic: 'Arrays',
      difficulty: 'Easy',
    });
    expect(codingService.getProblem).toHaveBeenCalledWith('two-sum');
  });

  it('starts a session using the authenticated user ID', async () => {
    codingService.startSession.mockResolvedValue(session);
    const dto = { problemIds: ['problem_001'] };

    const result = await controller.startSession(dto, 'user_001');

    expect(result).toEqual({ message: expect.any(String), data: session });
    expect(codingService.startSession).toHaveBeenCalledWith(dto, 'user_001');
  });

  it('passes session and authenticated user IDs to run and submit', async () => {
    codingService.runCode.mockResolvedValue(execution);
    codingService.submitSolution.mockResolvedValue({ ...execution, operation: 'submit' });
    const dto = {
      problemId: 'problem_001',
      language: 'javascript',
      code: 'function solution() {}',
    } satisfies ExecuteCodingDto;

    const run = await controller.runCode('session_001', dto, 'user_001');
    const submit = await controller.submitSolution('session_001', dto, 'user_001');

    expect(run).toEqual({ message: expect.any(String), data: execution });
    expect(submit).toEqual({
      message: expect.any(String),
      data: { ...execution, operation: 'submit' },
    });
    expect(codingService.runCode).toHaveBeenCalledWith('session_001', 'user_001', dto);
    expect(codingService.submitSolution).toHaveBeenCalledWith('session_001', 'user_001', dto);
  });

  it('looks up an execution using its session, execution, and authenticated user IDs', async () => {
    codingService.getExecution.mockResolvedValue(execution);

    await expect(
      controller.getExecution('session_001', 'execution_001', 'user_001')
    ).resolves.toEqual({ message: expect.any(String), data: execution });
    expect(codingService.getExecution).toHaveBeenCalledWith(
      'session_001',
      'execution_001',
      'user_001'
    );
  });

  it('passes authenticated identity through all session read/write operations', async () => {
    codingService.getSessionDetail.mockResolvedValue(session);
    codingService.completeSession.mockResolvedValue({ ...session, status: 'completed' });
    codingService.getSessionHistory.mockResolvedValue(history);

    const detail = await controller.getSessionDetail('session_001', 'user_001');
    const completed = await controller.completeSession('session_001', 'user_001');
    const sessions = await controller.getSessionHistory('user_001', { page: 1, limit: 20 });

    expect(detail).toEqual({ message: expect.any(String), data: session });
    expect(completed).toEqual({
      message: expect.any(String),
      data: expect.objectContaining({ status: 'completed' }),
    });
    expect(sessions).toEqual({ message: expect.any(String), data: history });
    expect(codingService.getSessionDetail).toHaveBeenCalledWith('session_001', 'user_001');
    expect(codingService.completeSession).toHaveBeenCalledWith('session_001', 'user_001');
    expect(codingService.getSessionHistory).toHaveBeenCalledWith('user_001', {
      page: 1,
      limit: 20,
    });
  });

  it('forwards service exceptions so Nest can map the documented HTTP status', async () => {
    const error = new Error('service unavailable');
    codingService.runCode.mockRejectedValue(error);

    await expect(
      controller.runCode(
        'session_001',
        { problemId: 'problem_001', language: 'javascript', code: 'function solution() {}' },
        'user_001'
      )
    ).rejects.toBe(error);
  });
});
