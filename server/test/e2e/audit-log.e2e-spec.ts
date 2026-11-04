import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient as PostgresAdminClient } from '../../src/generated/postgresql-client/index.js';
import { PrismaPostgresqlService } from '../../src/prisma/prisma.service.js';
import { AuditLogRetentionScheduler } from '../../src/modules/audit/audit-log-retention.scheduler.js';
import { AuditLogService } from '../../src/modules/audit/audit-log.service.js';
import {
  connectIsolationTestDatabases,
  disconnectIsolationTestDatabases,
} from './data-isolation-test-support.js';

type TDatabase = Awaited<ReturnType<typeof connectIsolationTestDatabases>>;

describe('PostgreSQL append-only audit log', () => {
  let database: TDatabase | undefined;
  let admin: PostgresAdminClient | undefined;

  beforeAll(async () => {
    database = await connectIsolationTestDatabases();
    const adminUrl = process.env['POSTGRESQL_ADMIN_URL'];
    if (!adminUrl)
      throw new Error('POSTGRESQL_ADMIN_URL is required for audit schema verification');
    admin = new PostgresAdminClient({ datasourceUrl: adminUrl });
    await admin.$connect();
  }, 30_000);

  afterAll(async () => {
    await admin?.$disconnect();
    if (database) await disconnectIsolationTestDatabases(database);
  }, 30_000);

  it('deduplicates appended events and preserves them after subject deletion', async () => {
    const suffix = randomUUID();
    const eventKey = `audit-test:${suffix}`;
    const subjectUserId = `deleted-user-${suffix}`;
    const service = new AuditLogService(database!.postgresProvider, {
      error: vi.fn(),
      warn: vi.fn(),
    } as never);
    const event = {
      actorType: 'PROVIDER' as const,
      subjectUserId,
      action: 'user.account_deleted' as const,
      resourceType: 'user' as const,
      resourceId: subjectUserId,
      eventKey,
    };

    await service.append(event);
    await service.append(event);
    const beforeDelete = await admin!.auditLog.findMany({ where: { eventKey } });

    expect(beforeDelete).toHaveLength(1);
    expect(beforeDelete[0]).toMatchObject({ action: 'user.account_deleted', subjectUserId });
  });

  it('denies runtime mutation and gives auditors select-only access', async () => {
    const eventKey = `audit-permissions:${randomUUID()}`;
    const service = new AuditLogService(database!.postgresProvider, {
      error: vi.fn(),
      warn: vi.fn(),
    } as never);
    await service.append({
      actorType: 'SYSTEM',
      action: 'payment.subscription_cancelled',
      resourceType: 'payment_subscription',
      eventKey,
    });
    const created = await admin!.auditLog.findUnique({ where: { eventKey } });
    expect(created).not.toBeNull();

    await expect(
      database!.postgres.auditLog.update({
        where: { id: created!.id },
        data: { action: 'test.mutated' },
      })
    ).rejects.toThrow();
    await expect(
      database!.postgres.auditLog.delete({ where: { id: created!.id } })
    ).rejects.toThrow();

    const privileges = await admin!.$queryRaw<
      Array<{
        auditorCanRead: boolean;
        auditorCanInsert: boolean;
        auditorCanUpdate: boolean;
        auditorCanDelete: boolean;
        apiCanRead: boolean;
        apiCanInsert: boolean;
        apiCanAppend: boolean;
      }>
    >`
      SELECT
        has_table_privilege('prepai_auditor', 'public."AuditLog"', 'SELECT') AS "auditorCanRead",
        has_table_privilege('prepai_auditor', 'public."AuditLog"', 'INSERT') AS "auditorCanInsert",
        has_table_privilege('prepai_auditor', 'public."AuditLog"', 'UPDATE') AS "auditorCanUpdate",
        has_table_privilege('prepai_auditor', 'public."AuditLog"', 'DELETE') AS "auditorCanDelete",
        has_table_privilege('prepai_api', 'public."AuditLog"', 'SELECT') AS "apiCanRead",
        has_table_privilege('prepai_api', 'public."AuditLog"', 'INSERT') AS "apiCanInsert",
        has_function_privilege('prepai_api', 'public.prepai_append_audit_log(text,text,text,text,text,text,text,text,jsonb)', 'EXECUTE') AS "apiCanAppend"
    `;
    expect(privileges[0]).toEqual({
      auditorCanRead: true,
      auditorCanInsert: false,
      auditorCanUpdate: false,
      auditorCanDelete: false,
      apiCanRead: false,
      apiCanInsert: false,
      apiCanAppend: true,
    });

    await expect(
      database!.postgres.$executeRaw`
        SELECT public.prepai_append_audit_log(
          ${randomUUID()}, ${'ANONYMOUS'}, ${null}, ${null},
          ${'webhook.signature_failed'}, ${'webhook'}, ${'razorpay'},
          ${`webhook-signature:razorpay:webhooks/razorpay:${Math.floor(Date.now() / 60_000)}`},
          ${JSON.stringify({ provider: 'RAZORPAY', route: 'webhooks/razorpay', rawBody: 'secret' })}::jsonb
        )
      `
    ).rejects.toThrow();
  });

  it('prunes only records older than two years through the restricted function', async () => {
    const suffix = randomUUID();
    const oldEventKey = `audit-old:${suffix}`;
    const recentEventKey = `audit-recent:${suffix}`;
    const oldDate = new Date();
    oldDate.setUTCFullYear(oldDate.getUTCFullYear() - 3);
    const recentDate = new Date();
    recentDate.setUTCFullYear(recentDate.getUTCFullYear() - 1);

    await admin!.auditLog.createMany({
      data: [
        {
          actorType: 'SYSTEM',
          action: 'test.old',
          resourceType: 'test',
          eventKey: oldEventKey,
          createdAt: oldDate,
        },
        {
          actorType: 'SYSTEM',
          action: 'test.recent',
          resourceType: 'test',
          eventKey: recentEventKey,
          createdAt: recentDate,
        },
      ],
    });
    const scheduler = new AuditLogRetentionScheduler(database!.postgresProvider);

    await scheduler.cleanup();

    await expect(
      admin!.auditLog.findUnique({ where: { eventKey: oldEventKey } })
    ).resolves.toBeNull();
    await expect(
      admin!.auditLog.findUnique({ where: { eventKey: recentEventKey } })
    ).resolves.toMatchObject({
      action: 'test.recent',
    });
  });
});
