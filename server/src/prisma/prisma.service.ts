import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PostgresPrismaClient } from '../generated/postgresql-client/index.js';
import type { Prisma } from '../generated/postgresql-client/index.js';

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
  private client: PostgresPrismaClient | undefined;
  private workerClient: PostgresPrismaClient | undefined;

  async onModuleInit(): Promise<void> {
    if (!process.env['POSTGRESQL_URL']) {
      this.logger.warn('POSTGRESQL_URL not set — PostgreSQL skipped');
      return;
    }

    try {
      this.client = new PostgresPrismaClient({ datasourceUrl: process.env['POSTGRESQL_URL'] });
      await this.client.$connect();
      const workerUrl = process.env['POSTGRESQL_WORKER_URL'];
      if (workerUrl) {
        this.workerClient = new PostgresPrismaClient({ datasourceUrl: workerUrl });
        await this.workerClient.$connect();
      } else if (process.env['NODE_ENV'] !== 'production') {
        this.workerClient = this.client;
        this.logger.warn(
          'POSTGRESQL_WORKER_URL not set; local worker is using the API database role'
        );
      }
      this.logger.log('PostgreSQL connected');
    } catch (error) {
      this.logger.error('PostgreSQL connection failed', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.client?.$disconnect(),
      this.workerClient !== this.client ? this.workerClient?.$disconnect() : undefined,
    ]);
  }

  get client_(): PostgresPrismaClient | undefined {
    return this.client;
  }

  get workerClient_(): PostgresPrismaClient | undefined {
    return this.workerClient;
  }

  async withTenantContext<T>(
    userId: string,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    this.assertIdentity(userId, 'Tenant identity is required');
    const client = this.client;
    if (!client) throw new Error('PostgreSQL API client is not connected');

    return client.$transaction(async (transaction) => {
      await this.setTenantContext(transaction, userId);
      return operation(transaction);
    });
  }

  async withWorkerJobContext<T>(
    jobId: string,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    this.assertIdentity(jobId, 'Worker job identity is required');
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');

    return client.$transaction(async (transaction) => {
      await this.setWorkerJobContext(transaction, jobId);
      return operation(transaction);
    });
  }

  async setTenantContext(transaction: Prisma.TransactionClient, userId: string): Promise<void> {
    this.assertIdentity(userId, 'Tenant identity is required');
    await transaction.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
  }

  async setWorkerJobContext(transaction: Prisma.TransactionClient, jobId: string): Promise<void> {
    this.assertIdentity(jobId, 'Worker job identity is required');
    await transaction.$executeRaw`SELECT set_config('app.worker_job_id', ${jobId}, true)`;
  }

  async setWorkerSessionContext(
    transaction: Prisma.TransactionClient,
    sessionId: string
  ): Promise<void> {
    this.assertIdentity(sessionId, 'Worker session identity is required');
    await transaction.$executeRaw`SELECT set_config('app.worker_session_id', ${sessionId}, true)`;
  }

  private assertIdentity(value: string, message: string): void {
    if (!value.trim()) throw new Error(message);
  }
}
