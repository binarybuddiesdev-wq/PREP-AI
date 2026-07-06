import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { redisStore } from 'cache-manager-ioredis-yet';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { appConfig } from './config/app.config.js';
import { loggerConfig, validateEnv } from './config/index.js';
import { SanitizeMiddleware } from './common/index.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { TechExpertModule } from './modules/tech-expert/tech-expert.module.js';
import { UserModule } from './modules/user/user.module.js';
import { TopicModule } from './modules/topic/topic.module.js';
import { QuestionModule } from './modules/question/question.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: validateEnv,
      envFilePath: join(__dirname, '..', '..', '.env'),
    }),
    LoggerModule.forRoot(loggerConfig),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        }),
        ttl: 300_000,
      }),
    }),
    PrismaModule,
    HealthModule, TechExpertModule, UserModule, TopicModule, QuestionModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SanitizeMiddleware)
      .forRoutes('{*path}');
  }
}
