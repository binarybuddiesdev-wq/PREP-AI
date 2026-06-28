import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const postgresqlSchemaPath = '../src/generated/postgresql-client/index.js';

let PrismaPostgresqlClient: typeof PrismaClient | undefined;
try {
  const mod = await import(postgresqlSchemaPath);
  PrismaPostgresqlClient = mod.PrismaClient;
} catch {
  // PostgreSQL client not generated yet — skip gracefully
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('MongoDB connected');
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Injectable()
export class PrismaPostgresqlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaPostgresqlService.name);
  private client: PrismaClient | undefined;

  async onModuleInit(): Promise<void> {
    if (!process.env['POSTGRESQL_URL']) {
      this.logger.warn('POSTGRESQL_URL not set — PostgreSQL skipped');
      return;
    }

    if (!PrismaPostgresqlClient) {
      this.logger.warn('PostgreSQL client not generated — skipping');
      return;
    }

    try {
      this.client = new PrismaPostgresqlClient();
      await this.client.$connect();
      this.logger.log('PostgreSQL connected');
    } catch (error) {
      this.logger.error('PostgreSQL connection failed', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }

  get client_(): PrismaClient | undefined {
    return this.client;
  }
}
