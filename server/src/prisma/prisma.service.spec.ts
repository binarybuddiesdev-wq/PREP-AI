import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  mongoConnect: vi.fn(),
  mongoDisconnect: vi.fn(),
  postgresConnect: vi.fn(),
  postgresDisconnect: vi.fn(),
  postgresConstructor: vi.fn(),
  postgresTransaction: vi.fn(),
  postgresExecuteRaw: vi.fn(),
  postgresQueryRaw: vi.fn(),
  postgresExtensions: [] as Array<Record<string, unknown>>,
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClientMock {
    $connect() {
      return prismaMocks.mongoConnect();
    }

    $disconnect() {
      return prismaMocks.mongoDisconnect();
    }
  },
}));

vi.mock('../generated/postgresql-client/index.js', () => ({
  PrismaClient: class PostgresPrismaClientMock {
    constructor(options?: unknown) {
      prismaMocks.postgresConstructor(options);
    }

    $connect() {
      return prismaMocks.postgresConnect();
    }

    $disconnect() {
      return prismaMocks.postgresDisconnect();
    }

    $extends(extension: Record<string, unknown>) {
      prismaMocks.postgresExtensions.push(extension);
      return this;
    }

    $queryRaw(...args: unknown[]) {
      return prismaMocks.postgresQueryRaw(...args);
    }

    $transaction(callback: (transaction: unknown) => unknown, options?: unknown) {
      return prismaMocks.postgresTransaction(callback, options);
    }
  },
}));

import { PrismaPostgresqlService, PrismaService } from './prisma.service.js';

const expectedRlsPolicies = [
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
];

const expectedPolicyRows = expectedRlsPolicies.map(([table_name, policy_name, role]) => ({
  table_name,
  policy_name,
  roles: [role],
  command: 'ALL',
}));

describe('Prisma services', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.postgresExtensions.length = 0;
    prismaMocks.mongoConnect.mockResolvedValue(undefined);
    prismaMocks.mongoDisconnect.mockResolvedValue(undefined);
    prismaMocks.postgresConnect.mockResolvedValue(undefined);
    prismaMocks.postgresDisconnect.mockResolvedValue(undefined);
    prismaMocks.postgresExecuteRaw.mockResolvedValue(1);
    prismaMocks.postgresQueryRaw.mockResolvedValue([{ session_id: 'session_1' }]);
    prismaMocks.postgresTransaction.mockImplementation((callback) =>
      callback({ $executeRaw: prismaMocks.postgresExecuteRaw })
    );
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('connects and disconnects the MongoDB Prisma client', async () => {
    const service = new PrismaService();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(prismaMocks.mongoConnect).toHaveBeenCalledOnce();
    expect(prismaMocks.mongoDisconnect).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('MongoDB connected');
  });

  it('logs a MongoDB connection failure and still allows shutdown', async () => {
    const connectionError = new Error('Mongo unavailable');
    prismaMocks.mongoConnect.mockRejectedValueOnce(connectionError);
    const service = new PrismaService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('MongoDB connection failed', connectionError);
    expect(prismaMocks.mongoDisconnect).toHaveBeenCalledOnce();
  });

  it('skips PostgreSQL when its connection string is absent', async () => {
    vi.stubEnv('POSTGRESQL_URL', '');
    const service = new PrismaPostgresqlService();

    await service.onModuleInit();

    expect(service.client_).toBeUndefined();
    expect(prismaMocks.postgresConstructor).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('POSTGRESQL_URL not set — PostgreSQL skipped');
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('connects and disconnects PostgreSQL when configured', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const service = new PrismaPostgresqlService();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(prismaMocks.postgresConstructor).toHaveBeenCalledTimes(2);
    expect(prismaMocks.postgresConstructor).toHaveBeenNthCalledWith(1, {
      datasourceUrl: 'postgresql://localhost:5432/prepai',
    });
    expect(prismaMocks.postgresConstructor).toHaveBeenNthCalledWith(2, {
      datasourceUrl: 'postgresql://localhost:5432/prepai',
    });
    expect(prismaMocks.postgresConnect).toHaveBeenCalledTimes(2);
    expect(prismaMocks.postgresDisconnect).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      'POSTGRESQL_WORKER_URL not set; separate worker pool is using the API database role'
    );
    expect(log).toHaveBeenCalledWith('PostgreSQL connected');
  });

  it('fails closed instead of using API credentials for the worker pool in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', '');
    const service = new PrismaPostgresqlService();

    await service.onModuleInit();

    expect(service.client_).toBeDefined();
    expect(service.workerClient_).toBeUndefined();
    expect(prismaMocks.postgresConstructor).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      'PostgreSQL connection failed',
      expect.objectContaining({ message: 'POSTGRESQL_WORKER_URL is required in production' })
    );
    await service.onModuleDestroy();
  });

  it('records bounded API PostgreSQL model query timing for successful and failed calls', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    const metrics = { recordPrismaQueryDuration: vi.fn() };
    const service = new PrismaPostgresqlService(metrics as never);
    await service.onModuleInit();

    expect(prismaMocks.postgresExtensions).toHaveLength(1);
    const extension = prismaMocks.postgresExtensions[0] as {
      query: {
        $allOperations: (input: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) => Promise<unknown>;
      };
    };
    const query = vi.fn().mockResolvedValue([]);
    await extension.query.$allOperations({
      model: 'TheorySession',
      operation: 'findMany',
      args: {},
      query,
    });

    const failure = new Error('database failed');
    await expect(
      extension.query.$allOperations({
        model: 'TheorySession',
        operation: 'findMany',
        args: {},
        query: vi.fn().mockRejectedValue(failure),
      })
    ).rejects.toBe(failure);
    expect(metrics.recordPrismaQueryDuration).toHaveBeenCalledTimes(2);
    expect(metrics.recordPrismaQueryDuration).toHaveBeenCalledWith(
      'TheorySession',
      'findMany',
      expect.any(Number)
    );
    await service.onModuleDestroy();
  });

  it('sets user identity inside a transaction before running tenant work', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    const operation = vi.fn().mockResolvedValue('tenant-result');
    await service.onModuleInit();

    await expect(service.withTenantContext('user_123', operation)).resolves.toBe('tenant-result');

    expect(prismaMocks.postgresTransaction).toHaveBeenCalledOnce();
    expect(prismaMocks.postgresExecuteRaw).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledOnce();
    await service.onModuleDestroy();
  });

  it('sets an admin claim only inside the admin transaction', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    const operation = vi.fn().mockResolvedValue('admin-result');
    await service.onModuleInit();

    await expect(service.withAdminContext('admin_1', operation)).resolves.toBe('admin-result');

    expect(prismaMocks.postgresTransaction).toHaveBeenCalledOnce();
    expect(prismaMocks.postgresExecuteRaw).toHaveBeenCalledTimes(3);
    expect(String(prismaMocks.postgresExecuteRaw.mock.calls[1]?.[0])).toContain(
      'app.current_user_is_admin'
    );
    expect(String(prismaMocks.postgresExecuteRaw.mock.calls[1]?.[0])).toContain('false');
    expect(String(prismaMocks.postgresExecuteRaw.mock.calls[2]?.[0])).toContain('true');
    expect(operation).toHaveBeenCalledOnce();
    await service.onModuleDestroy();
  });

  it('passes explicit transaction limits for tenant work that performs provider requests', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await service.withTenantContext('user_123', async () => 'done', {
      maxWait: 10_000,
      timeout: 45_000,
    });

    expect(prismaMocks.postgresTransaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 45_000,
    });
    await service.onModuleDestroy();
  });

  it('rejects empty tenant identities before starting a transaction', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.withTenantContext('  ', async () => undefined)).rejects.toThrow(
      'Tenant identity is required'
    );
    expect(prismaMocks.postgresTransaction).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it('connects the worker role separately and scopes its job transaction', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    const operation = vi.fn().mockResolvedValue('worker-result');
    await service.onModuleInit();

    await expect(service.withWorkerJobContext('job_123', operation)).resolves.toBe('worker-result');

    expect(prismaMocks.postgresConstructor).toHaveBeenNthCalledWith(1, {
      datasourceUrl: 'postgresql://api@localhost:5432/prepai',
    });
    expect(prismaMocks.postgresConstructor).toHaveBeenNthCalledWith(2, {
      datasourceUrl: 'postgresql://worker@localhost:5432/prepai',
    });
    expect(prismaMocks.postgresExecuteRaw).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledOnce();
    await service.onModuleDestroy();
    expect(prismaMocks.postgresDisconnect).toHaveBeenCalledTimes(2);
  });

  it('sets the persisted owner and job ID inside the worker tenant transaction', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    const operation = vi.fn().mockResolvedValue('worker-tenant-result');
    await service.onModuleInit();

    await expect(
      service.withWorkerTenantContext('user_1', 'payment-event-1', operation)
    ).resolves.toBe('worker-tenant-result');

    expect(prismaMocks.postgresTransaction).toHaveBeenCalledOnce();
    expect(prismaMocks.postgresExecuteRaw).toHaveBeenCalledTimes(3);
    expect(prismaMocks.postgresExecuteRaw.mock.calls[0]?.[1]).toBe('user_1');
    expect(prismaMocks.postgresExecuteRaw.mock.calls[2]?.[1]).toBe('payment-event-1');
    expect(operation).toHaveBeenCalledOnce();
    await expect(
      service.withWorkerTenantContext(' ', 'payment-event-1', operation)
    ).rejects.toThrow('Worker tenant identity is required');
    await expect(service.withWorkerTenantContext('user_1', ' ', operation)).rejects.toThrow(
      'Worker operation identity is required'
    );
    await service.onModuleDestroy();
  });

  it('scopes PDF worker writes to the persisted owner, source, and revision', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    const operation = vi.fn().mockResolvedValue('pdf-result');
    await service.onModuleInit();

    await expect(service.withWorkerPdfContext('user_1', 'source_1', 2, operation)).resolves.toBe(
      'pdf-result'
    );

    expect(prismaMocks.postgresExecuteRaw).toHaveBeenCalledTimes(4);
    expect(operation).toHaveBeenCalledOnce();
    await expect(service.withWorkerPdfContext('', 'source_1', 2, operation)).rejects.toThrow(
      'PDF worker owner identity is required'
    );
    await expect(service.withWorkerPdfContext('user_1', 'source_1', 0, operation)).rejects.toThrow(
      'PDF worker revision must be a positive integer'
    );
    await service.onModuleDestroy();
  });

  it('claims queued PDF study sessions through the narrow worker dispatch function', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.listQueuedPdfStudySessionIds(25)).resolves.toEqual(['session_1']);
    expect(prismaMocks.postgresQueryRaw).toHaveBeenCalledOnce();
    expect((prismaMocks.postgresQueryRaw.mock.calls[0]?.[0] as string[]).join('')).toContain(
      '::integer'
    );
    await service.onModuleDestroy();
  });

  it('runs bounded payment scans and retention through the separate worker client', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw.mockResolvedValue([{ deleted_refunds: 2, deleted_charges: 3 }]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await service.claimPendingPaymentWebhookEvents(500);
    await service.listExpiredPaymentSubscriptions(new Date(), 200);
    await service.claimPendingPaymentRefunds(101);
    await expect(service.deleteExpiredPaymentLedger(new Date())).resolves.toEqual({
      deleted_refunds: 2,
      deleted_charges: 3,
    });

    expect(prismaMocks.postgresQueryRaw).toHaveBeenCalledTimes(4);
    expect(prismaMocks.postgresQueryRaw.mock.calls.map((call) => String(call[0]))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('prepai_claim_pending_payment_webhook_events'),
        expect.stringContaining('prepai_list_expired_payment_subscriptions'),
        expect.stringContaining('prepai_claim_pending_payment_refunds'),
        expect.stringContaining('prepai_delete_expired_payment_ledger'),
      ])
    );
    expect(prismaMocks.postgresQueryRaw.mock.calls[0]?.[1]).toBe(100);
    expect(prismaMocks.postgresQueryRaw.mock.calls[1]?.[2]).toBe(100);
    expect(prismaMocks.postgresQueryRaw.mock.calls[2]?.[1]).toBe(100);
    await service.onModuleDestroy();
  });

  it('accepts restricted roles, forced tenant RLS, and worker-only functions', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_api',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_worker',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce(
        [
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
        ].map((table_name) => ({ table_name, rls_enabled: true, rls_forced: true }))
      )
      .mockResolvedValueOnce(expectedPolicyRows)
      .mockResolvedValueOnce(
        [
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
        ].map((function_signature) => ({
          function_signature,
          exists: true,
          worker_can_execute: true,
          api_can_execute: false,
        }))
      );
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).resolves.toBeUndefined();

    expect(prismaMocks.postgresQueryRaw).toHaveBeenCalledTimes(5);
    expect(prismaMocks.postgresQueryRaw.mock.calls[2]?.flat(Infinity)).toContain(
      'QuestionExposure'
    );
    expect(prismaMocks.postgresQueryRaw.mock.calls[2]?.flat(Infinity)).toContain(
      'QuestionRotation'
    );
    expect(prismaMocks.postgresQueryRaw.mock.calls[3]?.flat(Infinity)).toContain(
      'question_exposure_api_tenant'
    );
    expect(prismaMocks.postgresQueryRaw.mock.calls[3]?.flat(Infinity)).toContain(
      'question_rotation_api_tenant'
    );
    await service.onModuleDestroy();
  });

  it('rejects production RLS setup when an API role bypasses RLS', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw.mockResolvedValueOnce([
      {
        role_name: 'prepai_api',
        is_superuser: true,
        bypasses_rls: false,
        has_elevated_membership: false,
      },
    ]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(/prepai_api.*restricted/i);
    expect(prismaMocks.postgresQueryRaw).toHaveBeenCalledTimes(2);
    await service.onModuleDestroy();
  });

  it('rejects production RLS setup when a runtime role can assume an elevated role', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw.mockResolvedValueOnce([
      {
        role_name: 'prepai_api',
        is_superuser: false,
        bypasses_rls: false,
        has_elevated_membership: true,
      },
    ]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(
      /prepai_api.*restricted.*bypass RLS/i
    );
    await service.onModuleDestroy();
  });

  it('rejects production RLS setup when API can assume the worker role', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw.mockResolvedValueOnce([
      {
        role_name: 'prepai_api',
        is_superuser: false,
        bypasses_rls: false,
        has_elevated_membership: false,
        has_counterpart_membership: true,
      },
    ]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(
      /prepai_api.*must not assume.*prepai_worker/i
    );
    await service.onModuleDestroy();
  });

  it('rejects a required RLS policy installed on the wrong table or for the wrong role', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_api',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_worker',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce(
        [
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
        ].map((table_name) => ({ table_name, rls_enabled: true, rls_forced: true }))
      )
      .mockResolvedValueOnce([
        ...expectedPolicyRows.filter(
          (policy) => policy.policy_name !== 'payment_refund_worker_job'
        ),
        {
          table_name: 'PaymentCharge',
          policy_name: 'payment_refund_worker_job',
          roles: ['prepai_worker'],
          command: 'ALL',
        },
      ]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(
      /PaymentRefund\.payment_refund_worker_job/i
    );
    await service.onModuleDestroy();
  });

  it('rejects missing or unforced RLS tables and incorrect worker grants', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_api',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_worker',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce(
        [
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
        ].map((table_name) => ({
          table_name,
          rls_enabled: true,
          rls_forced: table_name !== 'PaymentRefund',
        }))
      );
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(
      /enabled and forced on: PaymentRefund/i
    );
    expect(prismaMocks.postgresQueryRaw).toHaveBeenCalledTimes(3);
    await service.onModuleDestroy();
  });

  it('rejects when expected RLS policies are missing', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_api',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_worker',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce(
        [
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
        ].map((table_name) => ({ table_name, rls_enabled: true, rls_forced: true }))
      )
      .mockResolvedValueOnce(
        expectedPolicyRows.filter((policy) => policy.policy_name !== 'payment_refund_worker_job')
      );
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(
      /policies are missing or misconfigured: PaymentRefund\.payment_refund_worker_job/i
    );
    expect(prismaMocks.postgresQueryRaw).toHaveBeenCalledTimes(4);
    await service.onModuleDestroy();
  });

  it('rejects worker function grants that are missing or exposed to the API', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_api',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          role_name: 'prepai_worker',
          is_superuser: false,
          bypasses_rls: false,
          has_elevated_membership: false,
        },
      ])
      .mockResolvedValueOnce(
        [
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
        ].map((table_name) => ({ table_name, rls_enabled: true, rls_forced: true }))
      )
      .mockResolvedValueOnce(expectedPolicyRows)
      .mockResolvedValueOnce([
        {
          function_signature: 'prepai_claim_pending_payment_refunds(integer)',
          exists: true,
          worker_can_execute: false,
          api_can_execute: true,
        },
      ]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.assertProductionRlsReady()).rejects.toThrow(
      /worker function grants are incomplete.*prepai_list_queued_theory_answer_ids/i
    );
    await service.onModuleDestroy();
  });

  it('rejects tenant/admin/worker work when the corresponding database client is unavailable', async () => {
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.withTenantContext('user_1', async () => undefined)).rejects.toThrow(
      'PostgreSQL API client is not connected'
    );
    await expect(service.withAdminContext('admin_1', async () => undefined)).rejects.toThrow(
      'PostgreSQL API client is not connected'
    );
    await expect(service.withWorkerJobContext('job_1', async () => undefined)).rejects.toThrow(
      'PostgreSQL worker client is not connected'
    );
    await expect(
      service.withWorkerTenantContext('user_1', 'job_1', async () => undefined)
    ).rejects.toThrow('PostgreSQL worker client is not connected');
    await expect(service.listQueuedPdfStudySessionIds()).rejects.toThrow(
      'PostgreSQL worker client is not connected'
    );
    await expect(service.claimPendingPaymentWebhookEvents()).rejects.toThrow(
      'PostgreSQL worker client is not connected'
    );
    await expect(service.listExpiredPaymentSubscriptions(new Date())).rejects.toThrow(
      'PostgreSQL worker client is not connected'
    );
    await expect(service.claimPendingPaymentRefunds()).rejects.toThrow(
      'PostgreSQL worker client is not connected'
    );
    await expect(service.deleteExpiredPaymentLedger(new Date())).rejects.toThrow(
      'PostgreSQL worker client is not connected'
    );
    await expect(
      service.withWorkerPdfContext('user_1', 'source_1', 1, async () => undefined)
    ).rejects.toThrow('PostgreSQL worker client is not connected');
  });

  it('fails when the payment retention function returns no result', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://api@localhost:5432/prepai');
    vi.stubEnv('POSTGRESQL_WORKER_URL', 'postgresql://worker@localhost:5432/prepai');
    prismaMocks.postgresQueryRaw.mockResolvedValueOnce([]);
    const service = new PrismaPostgresqlService();
    await service.onModuleInit();

    await expect(service.deleteExpiredPaymentLedger(new Date())).rejects.toThrow(
      'Payment retention function returned no result'
    );
    await service.onModuleDestroy();
  });

  it('logs PostgreSQL connection failures without failing module initialization', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const connectionError = new Error('Postgres unavailable');
    prismaMocks.postgresConnect.mockRejectedValueOnce(connectionError);
    const service = new PrismaPostgresqlService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('PostgreSQL connection failed', connectionError);
    expect(prismaMocks.postgresDisconnect).toHaveBeenCalledOnce();
  });
});
