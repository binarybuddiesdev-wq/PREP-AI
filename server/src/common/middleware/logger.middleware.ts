import { FastifyRequest, FastifyReply } from 'fastify';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    constructor(
        @InjectPinoLogger(LoggerMiddleware.name)
        private readonly logger: PinoLogger
    ) { }

    use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
        this.logger.info(`Incoming request: ${req.method} ${req.url}`);
        res.on('finish', () => {
            this.logger.info(`${req.method} ${req.url} -> ${res.statusCode}`);
        });
        next();
    }
}
