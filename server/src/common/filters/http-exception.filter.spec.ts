import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './http-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let reply: { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
  const request = { method: 'POST', url: '/api/test' };

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  function catchException(exception: unknown) {
    const host = {
      switchToHttp: () => ({
        getResponse: () => reply,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    filter.catch(exception, host);
  }

  it('returns a 429 response for Fastify rate-limit errors', () => {
    catchException({ statusCode: 429 });

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Too many requests, please slow down' })
    );
  });

  it('uses a string message from an HTTP exception response', () => {
    catchException(new BadRequestException('invalid input'));

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'invalid input' }));
  });

  it('joins validation messages from an HTTP exception response', () => {
    catchException(new BadRequestException(['name is required', 'email is invalid']));

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'name is required, email is invalid' })
    );
  });

  it('uses the exception message when the response has no message', () => {
    catchException(new HttpException({ error: 'bad request' }, HttpStatus.BAD_REQUEST));

    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Http Exception' }));
  });

  it('uses a safe default when an HTTP exception has no response', () => {
    const exception = new HttpException('fallback response', HttpStatus.BAD_REQUEST);
    Object.defineProperty(exception, 'response', { value: undefined });
    catchException(exception);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' })
    );
  });

  it('returns a generic 500 response for ordinary errors and logs the request context', () => {
    const error = new Error('unexpected failure');
    const logError = vi.spyOn(filter['logger'], 'error');
    catchException(error);

    expect(reply.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error', path: request.url })
    );
    expect(logError).toHaveBeenCalledWith(expect.stringContaining(error.message), 'POST /api/test');
  });

  it('includes an Error cause when logging server failures', () => {
    const error = new Error('outer error', { cause: new Error('root cause') });
    const logError = vi.spyOn(filter['logger'], 'error');

    catchException(error);

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('Cause: root cause'),
      'POST /api/test'
    );
  });

  it('logs non-Error thrown values without changing the safe response', () => {
    const logError = vi.spyOn(filter['logger'], 'error');
    catchException('unexpected string');

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('"unexpected string"'),
      'POST /api/test'
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' })
    );
  });

  it('returns arbitrary string or object HTTP exception responses safely', () => {
    catchException(new HttpException('plain response', HttpStatus.CONFLICT));
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'plain response' }));

    reply.send.mockClear();
    catchException(new HttpException({ detail: 'unrecognized shape' }, HttpStatus.CONFLICT));
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Http Exception' }));
  });
});
