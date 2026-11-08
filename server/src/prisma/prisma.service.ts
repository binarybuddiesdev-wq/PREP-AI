import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PostgresPrismaClient } from '../generated/postgresql-client/index.js';
import type { Prisma } from '../generated/postgresql-client/index.js';
import { MetricsService } from '../modules/metrics/metrics.service.js';

const RLS_PROTECTED_TABLES = [
  'TheorySession',
  'TheoryAnswer',
  'QuestionExposure',
  'QuestionRotation',
  'CodingSession',
  'CodingExecution',
  'CodingAnswer',
  'PdfChunk',
  'PaymentSubscription',
  'PaymentWebhookEvent',
  'PaymentCharge',
  'PaymentRefund',
] as const;

const RLS_REQUIRED_POLICIES = [
  ['TheorySession', 'theory_session_api_tenant', 'prepai_api'],
  ['TheorySession', 'theory_session_worker_tenant', 'prepai_worker'],
  ['TheoryAnswer', 'theory_answer_api_tenant', 'prepai_api'],
  ['TheoryAnswer', 'theory_answer_worker_job', 'prepai_worker'],
  ['QuestionExposure', 'question_exposure_api_tenant', 'prepai_api'],
  ['QuestionRotation', 'question_rotation_api_tenant', 'prepai_api'],
  ['CodingSession', 'coding_session_api_tenant', 'prepai_api'],
  ['CodingSession', 'coding_session_worker_tenant', 'prepai_worker'],
  ['CodingExecution', 'coding_execution_api_tenant', 'prepai_api'],
  ['CodingExecution', 'coding_execution_worker_job', 'prepai_worker'],
  ['CodingAnswer', 'coding_answer_api_tenant', 'prepai_api'],
  ['CodingAnswer', 'coding_answer_worker_job', 'prepai_worker'],
  ['PdfChunk', 'pdf_chunk_api_tenant', 'prepai_api'],
  ['PdfChunk', 'pdf_chunk_worker_source', 'prepai_worker'],
  ['PaymentSubscription', 'payment_subscription_api_tenant', 'prepai_api'],
  ['PaymentSubscription', 'payment_subscription_worker_tenant', 'prepai_worker'],
  ['PaymentWebhookEvent', 'payment_webhook_event_api_tenant', 'prepai_api'],
  ['PaymentWebhookEvent', 'payment_webhook_event_worker_job', 'prepai_worker'],
  ['PaymentCharge', 'payment_charge_api_tenant', 'prepai_api'],
  ['PaymentRefund', 'payment_refund_api_tenant', 'prepai_api'],
  ['PaymentRefund', 'payment_refund_worker_job', 'prepai_worker'],
] as const;

const WORKER_ONLY_FUNCTIONS = [
  'prepai_list_queued_theory_answer_ids(integer)',
  'prepai_get_theory_answer_owner(text)',
  'prepai_list_queued_coding_execution_ids(integer)',
  'prepai_list_queued_coding_review_execution_ids(integer)',
  'prepai_get_coding_execution_owner(text)',
  'prepai_list_queued_pdf_study_session_ids(integer)',
  'prepai_get_pdf_study_session_owner(text)',
  'prepai_claim_pending_payment_webhook_events(integer)',
  'prepai_list_expired_payment_subscriptions(timestamptz,integer)',
  'prepai_claim_pending_payment_refunds(integer)',
  'prepai_delete_expired_payment_ledger(timestamptz)',
] as const;

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

  async assertProductionRlsReady(): Promise<void> {
    const api = this.client;
    const worker = this.workerClient;
    if (!api) throw new Error('PostgreSQL API client is not connected');
    if (!worker) throw new Error('PostgreSQL worker client is not connected');

    const [apiRole] = await api.$queryRaw<
      Array<{
        role_name: string;
        is_superuser: boolean;
        bypasses_rls: boolean;
        has_elevated_membership: boolean;
        has_counterpart_membership: boolean;
      }>
    >`
      WITH RECURSIVE reachable_roles(role_oid) AS (
        SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user
        UNION
        SELECT membership.roleid
        FROM pg_catalog.pg_auth_members AS membership
        JOIN reachable_roles AS reachable ON membership.member = reachable.role_oid
      )
      SELECT current_user AS role_name, role.rolsuper AS is_superuser,
        role.rolbypassrls AS bypasses_rls,
        EXISTS (
          SELECT 1 FROM reachable_roles AS reachable
          JOIN pg_catalog.pg_roles AS inherited ON inherited.oid = reachable.role_oid
          WHERE inherited.oid <> role.oid AND (inherited.rolsuper OR inherited.rolbypassrls)
        ) AS has_elevated_membership
        , EXISTS (
          SELECT 1 FROM reachable_roles AS reachable
          JOIN pg_catalog.pg_roles AS inherited ON inherited.oid = reachable.role_oid
          WHERE inherited.oid <> role.oid
            AND inherited.rolname = CASE current_user
              WHEN 'prepai_api' THEN 'prepai_worker'
              WHEN 'prepai_worker' THEN 'prepai_api'
            END
        ) AS has_counterpart_membership
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = current_user
    `;
    const [workerRole] = await worker.$queryRaw<
      Array<{
        role_name: string;
        is_superuser: boolean;
        bypasses_rls: boolean;
        has_elevated_membership: boolean;
        has_counterpart_membership: boolean;
      }>
    >`
      WITH RECURSIVE reachable_roles(role_oid) AS (
        SELECT role.oid FROM pg_catalog.pg_roles AS role WHERE role.rolname = current_user
        UNION
        SELECT membership.roleid
        FROM pg_catalog.pg_auth_members AS membership
        JOIN reachable_roles AS reachable ON membership.member = reachable.role_oid
      )
      SELECT current_user AS role_name, role.rolsuper AS is_superuser,
        role.rolbypassrls AS bypasses_rls,
        EXISTS (
          SELECT 1 FROM reachable_roles AS reachable
          JOIN pg_catalog.pg_roles AS inherited ON inherited.oid = reachable.role_oid
          WHERE inherited.oid <> role.oid AND (inherited.rolsuper OR inherited.rolbypassrls)
        ) AS has_elevated_membership
        , EXISTS (
          SELECT 1 FROM reachable_roles AS reachable
          JOIN pg_catalog.pg_roles AS inherited ON inherited.oid = reachable.role_oid
          WHERE inherited.oid <> role.oid
            AND inherited.rolname = CASE current_user
              WHEN 'prepai_api' THEN 'prepai_worker'
              WHEN 'prepai_worker' THEN 'prepai_api'
            END
        ) AS has_counterpart_membership
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = current_user
    `;

    this.assertRestrictedRole(apiRole, 'prepai_api');
    this.assertRestrictedRole(workerRole, 'prepai_worker');

    const tables = await api.$queryRaw<
      Array<{ table_name: string; rls_enabled: boolean; rls_forced: boolean }>
    >`
      SELECT relation.relname AS table_name,
        relation.relrowsecurity AS rls_enabled,
        relation.relforcerowsecurity AS rls_forced
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS schema ON schema.oid = relation.relnamespace
      WHERE schema.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relname = ANY(${[...RLS_PROTECTED_TABLES]}::text[])
    `;
    const tablesByName = new Map(tables.map((table) => [table.table_name, table]));
    const missingTables = RLS_PROTECTED_TABLES.filter((name) => !tablesByName.has(name));
    if (missingTables.length) {
      throw new Error(`PostgreSQL RLS tenant tables are missing: ${missingTables.join(', ')}`);
    }
    const unforcedTables = RLS_PROTECTED_TABLES.filter((name) => {
      const table = tablesByName.get(name);
      return !table?.rls_enabled || !table.rls_forced;
    });
    if (unforcedTables.length) {
      throw new Error(`PostgreSQL RLS must be enabled and forced on: ${unforcedTables.join(', ')}`);
    }

    const policies = await api.$queryRaw<
      Array<{ table_name: string; policy_name: string; roles: string[]; command: string }>
    >`
      SELECT tablename AS table_name, policyname AS policy_name, roles, cmd AS command
      FROM pg_catalog.pg_policies
      WHERE schemaname = 'public'
        AND policyname = ANY(${RLS_REQUIRED_POLICIES.map(([, name]) => name)}::text[])
    `;
    const policyKey = (table: string, name: string) => `${table}.${name}`;
    const existingPolicies = new Set(
      policies.map(({ table_name, policy_name, roles, command }) =>
        roles.length === 1 && command === 'ALL'
          ? `${policyKey(table_name, policy_name)}:${roles[0]}`
          : ''
      )
    );
    const missingPolicies = RLS_REQUIRED_POLICIES.filter(
      ([table, name, role]) => !existingPolicies.has(`${policyKey(table, name)}:${role}`)
    );
    if (missingPolicies.length) {
      throw new Error(
        `PostgreSQL RLS policies are missing or misconfigured: ${missingPolicies
          .map(([table, name]) => `${table}.${name}`)
          .join(', ')}`
      );
    }

    const functions = await api.$queryRaw<
      Array<{
        function_signature: string;
        exists: boolean;
        worker_can_execute: boolean;
        api_can_execute: boolean;
      }>
    >`
      SELECT required.function_signature,
        to_regprocedure(required.function_signature) IS NOT NULL AS exists,
        COALESCE(
          has_function_privilege('prepai_worker', to_regprocedure(required.function_signature), 'EXECUTE'),
          false
        ) AS worker_can_execute,
        COALESCE(
          has_function_privilege('prepai_api', to_regprocedure(required.function_signature), 'EXECUTE'),
          false
        ) AS api_can_execute
      FROM unnest(${[...WORKER_ONLY_FUNCTIONS]}::text[]) AS required(function_signature)
    `;
    const functionsByName = new Map(functions.map((fn) => [fn.function_signature, fn]));
    const unavailableFunctions = WORKER_ONLY_FUNCTIONS.filter((signature) => {
      const fn = functionsByName.get(signature);
      return !fn?.exists || !fn.worker_can_execute || fn.api_can_execute;
    });
    if (unavailableFunctions.length) {
      throw new Error(
        `PostgreSQL worker function grants are incomplete: ${unavailableFunctions.join(', ')}`
      );
    }
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
      FROM public.prepai_list_queued_pdf_study_session_ids(${safeLimit}::integer)
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

  private assertRestrictedRole(
    role:
      | {
          role_name: string;
          is_superuser: boolean;
          bypasses_rls: boolean;
          has_elevated_membership: boolean;
          has_counterpart_membership: boolean;
        }
      | undefined,
    expectedName: string
  ): void {
    if (role?.role_name !== expectedName) {
      throw new Error(`Production PostgreSQL connection must use the ${expectedName} role`);
    }
    if (role.is_superuser || role.bypasses_rls || role.has_elevated_membership) {
      throw new Error(`PostgreSQL role ${expectedName} must be restricted and must not bypass RLS`);
    }
    const counterpart = expectedName === 'prepai_api' ? 'prepai_worker' : 'prepai_api';
    if (role.has_counterpart_membership) {
      throw new Error(`PostgreSQL role ${expectedName} must not assume ${counterpart}`);
    }
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
