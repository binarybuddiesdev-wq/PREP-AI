import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PostgresPrismaClient } from '../generated/postgresql-client/index.js';
import type { Prisma } from '../generated/postgresql-client/index.js';
import { MetricsService } from '../modules/metrics/metrics.service.js';

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

  constructor(@Optional() private readonly metrics?: MetricsService) {}

  async onModuleInit(): Promise<void> {
    if (!process.env['POSTGRESQL_URL']) {
      this.logger.warn('POSTGRESQL_URL not set — PostgreSQL skipped');
      return;
    }

    try {
      this.client = this.createClient(process.env['POSTGRESQL_URL']);
      await this.client.$connect();
      const workerUrl = process.env['POSTGRESQL_WORKER_URL'];
      if (!workerUrl && process.env['NODE_ENV'] === 'production') {
        throw new Error('POSTGRESQL_WORKER_URL is required in production');
      }
      if (workerUrl) {
        this.workerClient = this.createClient(workerUrl, false);
        await this.workerClient.$connect();
      } else {
        // Keep a distinct local pool for audit writes that commit under an API transaction lock.
        this.workerClient = this.createClient(process.env['POSTGRESQL_URL'], false);
        await this.workerClient.$connect();
        this.logger.warn(
          'POSTGRESQL_WORKER_URL not set; separate worker pool is using the API database role'
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
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    this.assertIdentity(userId, 'Tenant identity is required');
    const client = this.client;
    if (!client) throw new Error('PostgreSQL API client is not connected');

    return client.$transaction(async (transaction) => {
      await this.setTenantContext(transaction, userId);
      return operation(transaction);
    }, options);
  }

  async withAdminContext<T>(
    userId: string,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    this.assertIdentity(userId, 'Admin identity is required');
    const client = this.client;
    if (!client) throw new Error('PostgreSQL API client is not connected');

    return client.$transaction(async (transaction) => {
      await this.setTenantContext(transaction, userId);
      await transaction.$executeRaw`SELECT set_config('app.current_user_is_admin', 'true', true)`;
      return operation(transaction);
    }, options);
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

  async withWorkerTenantContext<T>(
    userId: string,
    operationId: string,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    this.assertIdentity(userId, 'Worker tenant identity is required');
    this.assertIdentity(operationId, 'Worker operation identity is required');
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');

    return client.$transaction(async (transaction) => {
      await this.setTenantContext(transaction, userId);
      await this.setWorkerJobContext(transaction, operationId);
      return operation(transaction);
    });
  }

  async setTenantContext(transaction: Prisma.TransactionClient, userId: string): Promise<void> {
    this.assertIdentity(userId, 'Tenant identity is required');
    await transaction.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await transaction.$executeRaw`SELECT set_config('app.current_user_is_admin', 'false', true)`;
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

  async listQueuedPdfStudySessionIds(limit = 100): Promise<string[]> {
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
    const rows = await client.$queryRaw<Array<{ session_id: string }>>`
      SELECT session_id
      FROM public.prepai_list_queued_pdf_study_session_ids(${safeLimit})
    `;
    return rows.map((row) => row.session_id);
  }

  async claimPendingPaymentWebhookEvents(
    limit = 100
  ): Promise<Array<{ id: string; user_id: string; event_id: string }>> {
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');
    const safeLimit = this.clampWorkerLimit(limit);
    return client.$queryRaw<Array<{ id: string; user_id: string; event_id: string }>>`
      SELECT id, user_id, event_id
      FROM public.prepai_claim_pending_payment_webhook_events(${safeLimit}::integer)
    `;
  }

  async listExpiredPaymentSubscriptions(
    cutoff: Date,
    limit = 100
  ): Promise<
    Array<{
      id: string;
      user_id: string;
      idempotency_key: string;
      razorpay_subscription_id: string | null;
    }>
  > {
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');
    const safeLimit = this.clampWorkerLimit(limit);
    return client.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        idempotency_key: string;
        razorpay_subscription_id: string | null;
      }>
    >`
      SELECT id, user_id, idempotency_key, razorpay_subscription_id
      FROM public.prepai_list_expired_payment_subscriptions(${cutoff}, ${safeLimit}::integer)
    `;
  }

  async claimPendingPaymentRefunds(limit = 100): Promise<
    Array<{
      id: string;
      user_id: string;
      razorpay_payment_id: string;
      razorpay_refund_id: string | null;
      amount_minor: number;
      currency: string;
    }>
  > {
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');
    const safeLimit = this.clampWorkerLimit(limit);
    return client.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        razorpay_payment_id: string;
        razorpay_refund_id: string | null;
        amount_minor: number;
        currency: string;
      }>
    >`
      SELECT id, user_id, razorpay_payment_id, razorpay_refund_id, amount_minor, currency
      FROM public.prepai_claim_pending_payment_refunds(${safeLimit}::integer)
    `;
  }

  async deleteExpiredPaymentLedger(cutoff: Date): Promise<{
    deleted_refunds: number;
    deleted_charges: number;
  }> {
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');
    const [result] = await client.$queryRaw<
      Array<{ deleted_refunds: number; deleted_charges: number }>
    >`
      SELECT deleted_refunds, deleted_charges
      FROM public.prepai_delete_expired_payment_ledger(${cutoff})
    `;
    if (!result) throw new Error('Payment retention function returned no result');
    return result;
  }

  async withWorkerPdfContext<T>(
    ownerId: string,
    sourceId: string,
    revision: number,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    this.assertIdentity(ownerId, 'PDF worker owner identity is required');
    this.assertIdentity(sourceId, 'PDF worker source identity is required');
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error('PDF worker revision must be a positive integer');
    }
    const client = this.workerClient;
    if (!client) throw new Error('PostgreSQL worker client is not connected');

    return client.$transaction(async (transaction) => {
      await this.setTenantContext(transaction, ownerId);
      await transaction.$executeRaw`SELECT set_config('app.worker_source_id', ${sourceId}, true)`;
      await transaction.$executeRaw`SELECT set_config('app.worker_revision', ${String(revision)}, true)`;
      return operation(transaction);
    });
  }

  private assertIdentity(value: string, message: string): void {
    if (!value.trim()) throw new Error(message);
  }

  private clampWorkerLimit(limit: number): number {
    return Math.min(Math.max(Math.floor(limit), 1), 100);
  }

  private createClient(datasourceUrl: string, measureQueries = true): PostgresPrismaClient {
    const client = new PostgresPrismaClient({ datasourceUrl });
    const metrics = this.metrics;
    if (!metrics || !measureQueries) return client;

    return client.$extends({
      name: 'prepai-query-duration-metrics',
      query: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) return query(args);
          const startedAt = performance.now();
          try {
            return await query(args);
          } finally {
            metrics.recordPrismaQueryDuration(
              model,
              operation,
              (performance.now() - startedAt) / 1_000
            );
          }
        },
      },
    }) as unknown as PostgresPrismaClient;
  }
}
