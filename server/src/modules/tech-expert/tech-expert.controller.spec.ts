import { EventEmitter } from 'node:events';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TechExpertController } from './tech-expert.controller.js';
import { TechExpertService } from './tech-expert.service.js';
import { ITechExpertResponse } from './tech-expert.types.js';
import type { FastifyReply } from 'fastify';

class MockRawResponse extends EventEmitter {
  public writableEnded = false;
  public chunks: string[] = [];
  public writeHead = vi.fn();
  public flushHeaders = vi.fn();
  public end = vi.fn(() => {
    this.writableEnded = true;
    this.emit('close');
  });
  public disconnectOnFirstWrite = false;
  public backpressureOnFirstWrite = false;

  public write = vi.fn((chunk: string) => {
    this.chunks.push(chunk);
    if (this.disconnectOnFirstWrite) this.emit('close');
    if (this.backpressureOnFirstWrite && this.chunks.length === 1) {
      setTimeout(() => this.emit('drain'), 0);
      return false;
    }
    return true;
  });
}

describe('TechExpertController', () => {
  let controller: TechExpertController;
  let mockService: TechExpertService;

  beforeEach(() => {
    mockService = {
      askQuestion: vi.fn(),
      streamQuestion: vi.fn(),
    } as unknown as TechExpertService;

    controller = new TechExpertController(mockService);
  });

  it('should forward request body to the service and return the response', async () => {
    // Arrange
    const body = { question: 'Explain REST vs GraphQL' };
    const expectedResponse: ITechExpertResponse = {
      data: {
        answer: {
          topic: 'REST vs GraphQL',
          summary: 'Comparison of API architectural styles.',
          keyPoints: [],
          examples: [],
          relatedTopics: [],
        },
        rawResponse: '{}',
      },
      error: null,
      meta: {},
    };

    vi.mocked(mockService.askQuestion).mockResolvedValue(expectedResponse);

    // Act
    const result = await controller.ask(body);

    // Assert
    expect(mockService.askQuestion).toHaveBeenCalledWith(body);
    expect(result).toEqual(expectedResponse);
  });

  it('streams SSE deltas followed by a completion event', async () => {
    const order: string[] = [];
    vi.mocked(mockService.streamQuestion).mockImplementation(async function* () {
      yield 'first ';
      order.push('next chunk requested');
      yield 'second';
    });
    const raw = new MockRawResponse();
    raw.backpressureOnFirstWrite = true;
    raw.on('drain', () => order.push('drain'));
    const reply = {
      raw,
      hijack: vi.fn(),
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;

    await controller.stream({ question: 'Explain REST' }, reply);

    expect(mockService.streamQuestion).toHaveBeenCalledWith(
      { question: 'Explain REST' },
      expect.any(AbortSignal)
    );
    expect(reply.header).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(raw.writeHead).toHaveBeenCalledWith(200);
    expect(raw.chunks).toEqual([
      'event: delta\ndata: {"text":"first "}\n\n',
      'event: delta\ndata: {"text":"second"}\n\n',
      'event: done\ndata: {}\n\n',
    ]);
    expect(order).toEqual(['drain', 'next chunk requested']);
    expect(raw.end).toHaveBeenCalledOnce();
  });

  it('returns an HTTP error when generation fails before the first chunk', async () => {
    vi.mocked(mockService.streamQuestion).mockImplementation(async function* () {
      yield* [];
      throw new Error('provider secrets and internals');
    });
    const raw = new MockRawResponse();
    const reply = {
      raw,
      hijack: vi.fn(),
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;

    await expect(controller.stream({ question: 'Explain REST' }, reply)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
    expect(raw.writeHead).not.toHaveBeenCalled();
  });

  it('sends a safe error event after output and aborts generation when the client disconnects', async () => {
    vi.mocked(mockService.streamQuestion).mockImplementation(async function* () {
      yield 'partial';
      throw new Error('provider internals');
    });
    const raw = new MockRawResponse();
    const reply = {
      raw,
      hijack: vi.fn(),
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;

    await controller.stream({ question: 'Explain REST' }, reply);

    expect(raw.chunks).toContain(
      'event: error\ndata: {"error":"The answer stream ended unexpectedly."}\n\n'
    );
    expect(raw.end).toHaveBeenCalledOnce();

    const disconnectedRaw = new MockRawResponse();
    disconnectedRaw.disconnectOnFirstWrite = true;
    let generatorClosed = false;
    vi.mocked(mockService.streamQuestion).mockImplementation(async function* () {
      try {
        yield 'first';
        yield 'must-not-be-read';
      } finally {
        generatorClosed = true;
      }
    });
    const disconnectedReply = {
      raw: disconnectedRaw,
      hijack: vi.fn(),
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as FastifyReply;

    await controller.stream({ question: 'Explain REST' }, disconnectedReply);

    expect(disconnectedRaw.chunks).toEqual(['event: delta\ndata: {"text":"first"}\n\n']);
    expect(generatorClosed).toBe(true);
    expect(vi.mocked(mockService.streamQuestion).mock.calls.at(-1)?.[1]?.aborted).toBe(true);
  });
});
