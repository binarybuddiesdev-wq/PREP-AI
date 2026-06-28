import { FastifyReply, FastifyRequest } from 'fastify';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (
      typeof exception === 'object' &&
      exception !== null &&
      'statusCode' in exception &&
      (exception as Record<string, unknown>).statusCode === 429
    ) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'Too many requests, please slow down';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = this.extractMessage(exception, exceptionResponse);
    }

    if (status >= 500) {
      const errorMessage = exception instanceof Error
        ? `${exception.message}\n${exception.stack}`
        : JSON.stringify(exception);
      this.logger.error(
        `HTTP ${status} Error: ${errorMessage}`,
        `${request.method} ${request.url}`
      );
    } else {
      this.logger.warn(
        `HTTP ${status} Warning: ${message}`,
        `${request.method} ${request.url}`
      );
    }

    void reply.status(status).send({
      success: false,
      message,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(exception: unknown, exceptionResponse: unknown): string {
    if (!exceptionResponse) {
      return 'Internal server error';
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse) {
      const message = (exceptionResponse as { message: unknown }).message;
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }

    if (exception instanceof HttpException) {
      return exception.message;
    }

    return 'Internal server error';
  }
}
