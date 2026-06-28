import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => {
  const databaseUrl = process.env.DATABASE_URL;
  const postgresqlUrl = process.env.POSTGRESQL_URL;
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (nodeEnv !== 'test') {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required but not defined in environment variables');
    }
  }

  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be one of: development, production, test');
  }

  return {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    nodeEnv,
    databaseUrl: databaseUrl ?? '',
    postgresqlUrl: postgresqlUrl ?? '',
  };
});
