import { Params } from 'nestjs-pino';
import { getCurrentTraceLogFields } from '@/telemetry/trace-context.js';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const loggerConfig: Params = {
  pinoHttp: {
    mixin: getCurrentTraceLogFields,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
      censor: '[REDACTED]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
          },
        }
      : undefined,
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} -> ${res.statusCode}`;
    },
    level: isDevelopment ? 'debug' : 'info',
  },
};
