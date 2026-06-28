import { Injectable, NestMiddleware } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'node:http';

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  use(req: IncomingMessage & { body?: unknown }, res: ServerResponse, next: () => void) {
    if (req.body && typeof req.body === 'object' && req.body !== null) {
      const requestBody = req.body as Record<string, unknown>;
      Object.keys(requestBody).forEach((key) => {
        if (typeof requestBody[key] === 'string') {
          requestBody[key] = (requestBody[key] as string).trim();
        }
      });
    }
    next();
  }
}
