import { Params } from 'nestjs-pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const loggerConfig: Params = {
  pinoHttp: {
    transport: isDevelopment ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    } : undefined,
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} -> ${res.statusCode}`;
    },
    level: isDevelopment ? 'debug' : 'info',
  }
};
