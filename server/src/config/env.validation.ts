import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().optional(),
  POSTGRESQL_URL: z.string().optional(),
  REDIS_HOST: z.string().optional().default('localhost'),
  REDIS_PORT: z.coerce.number().optional().default(6379),
  CORS_ORIGIN: z.string().optional().default('*'),
  CLERK_SECRET_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  MASTRA_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_BASE_URL: z.string().optional().default('https://integrate.api.nvidia.com/v1'),
  NVIDIA_MODEL: z.string().optional().default('meta/llama-3.1-8b-instruct'),
}).passthrough().refine((data) => {
  if (data.NODE_ENV !== 'test') {
    if (!data.DATABASE_URL) return false;
  }
  return true;
}, {
  message: "DATABASE_URL is required when NODE_ENV is not 'test'",
  path: ['DATABASE_URL'],
});

export type TEnv = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`Invalid environment variables:\n${errors}`);
  }
  return result.data;
};
