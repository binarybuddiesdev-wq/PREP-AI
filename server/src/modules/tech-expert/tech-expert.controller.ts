import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UsePipes,
  HttpCode,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TechExpertService } from './tech-expert.service.js';
import {
  ITechExpertResponse,
  techExpertRequestSchema,
  TechExpertRequestDto,
  TechExpertResponseDto,
} from './tech-expert.types.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiProduces } from '@nestjs/swagger';
import {
  PROMPT_INJECTION_BLOCKED_MESSAGE,
  PromptInjectionBlockedError,
} from '../../mastra/prompt-injection-guard.js';

@ApiTags('Tech Expert')
@Controller('tech-expert')
export class TechExpertController {
  constructor(private readonly techExpertService: TechExpertService) {}

  @Post()
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(techExpertRequestSchema))
  @ApiOperation({
    summary:
      'Ask any technology-related question - programming, cloud, AI/ML, databases, DevOps, and more',
  })
  @ApiBody({ type: TechExpertRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Successful AI response about technology topics',
    type: TechExpertResponseDto,
  })
  public async ask(@Body() body: TechExpertRequestDto): Promise<ITechExpertResponse> {
    return this.techExpertService.askQuestion(body);
  }

  @Post('stream')
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(techExpertRequestSchema))
  @ApiOperation({ summary: 'Stream a technology-related answer using Server-Sent Events' })
  @ApiProduces('text/event-stream')
  @ApiBody({ type: TechExpertRequestDto })
  @ApiResponse({ status: 200, description: 'SSE stream with delta, done, or error events' })
  @ApiResponse({ status: 503, description: 'The answer stream could not be started' })
  public async stream(
    @Body() body: TechExpertRequestDto,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const abortController = new AbortController();
    const stream = this.techExpertService.streamQuestion(body, abortController.signal);
    const iterator = stream[Symbol.asyncIterator]();
    let disconnected = false;

    const onClose = () => {
      if (!reply.raw.writableEnded) {
        disconnected = true;
        abortController.abort();
      }
    };

    reply.raw.on('close', onClose);

    let first: IteratorResult<string>;
    try {
      first = await iterator.next();
    } catch (error) {
      reply.raw.off('close', onClose);
      if (disconnected) {
        await iterator.return?.(undefined);
        return;
      }
      if (error instanceof PromptInjectionBlockedError) {
        await iterator.return?.(undefined);
        throw new BadRequestException(PROMPT_INJECTION_BLOCKED_MESSAGE);
      }
      throw new ServiceUnavailableException('Unable to start answer stream. Please try again.');
    }

    if (disconnected) {
      await iterator.return?.(undefined);
      reply.raw.off('close', onClose);
      return;
    }

    reply.header('Content-Type', 'text/event-stream; charset=utf-8');
    reply.header('Cache-Control', 'no-cache, no-transform');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no');
    reply.hijack();
    reply.raw.writeHead(200);
    reply.raw.flushHeaders();

    let failed = false;
    try {
      let current = first;
      while (!disconnected && !current.done) {
        await writeSseEvent(reply, 'delta', { text: current.value }, () => disconnected);
        if (disconnected) break;
        current = await iterator.next();
      }
    } catch {
      if (!disconnected) {
        failed = true;
        await writeSseEvent(
          reply,
          'error',
          { error: 'The answer stream ended unexpectedly.' },
          () => disconnected
        );
      }
    } finally {
      if (disconnected) {
        abortController.abort();
        await iterator.return?.(undefined);
      } else if (!failed) {
        await writeSseEvent(reply, 'done', {}, () => disconnected);
      }
      reply.raw.off('close', onClose);
      if (!reply.raw.writableEnded && !disconnected) reply.raw.end();
    }
  }
}

function encodeSseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function writeSseEvent(
  reply: FastifyReply,
  event: string,
  data: Record<string, unknown>,
  isDisconnected: () => boolean
): Promise<void> {
  if (isDisconnected()) return;
  if (reply.raw.write(encodeSseEvent(event, data))) return;

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      reply.raw.off('drain', cleanup);
      reply.raw.off('close', cleanup);
      resolve();
    };

    reply.raw.once('drain', cleanup);
    reply.raw.once('close', cleanup);
    if (isDisconnected()) cleanup();
  });
}
