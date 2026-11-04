import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditLogRetentionScheduler } from './audit-log-retention.scheduler.js';

describe('AuditLogRetentionScheduler', () => {
  it('calls only the restricted database pruning function', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ deleted_count: 3n }]);
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const scheduler = new AuditLogRetentionScheduler({ client_: { $queryRaw: queryRaw } } as never);

    await scheduler.cleanup();

    expect(queryRaw).toHaveBeenCalledOnce();
    expect(queryRaw.mock.calls[0]?.[0].join(' ')).toContain(
      'SELECT public.prepai_prune_audit_log() AS deleted_count'
    );
    expect(log).toHaveBeenCalledWith({ deletedCount: 3 }, 'Audit log retention completed');
    log.mockRestore();
  });

  it('does nothing when PostgreSQL is not connected', async () => {
    const scheduler = new AuditLogRetentionScheduler({ client_: undefined } as never);

    await expect(scheduler.cleanup()).resolves.toBeUndefined();
  });

  it('logs a warning and keeps the scheduler alive when pruning fails', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const scheduler = new AuditLogRetentionScheduler({
      client_: { $queryRaw: vi.fn().mockRejectedValue(new Error('database unavailable')) },
    } as never);

    await expect(scheduler.cleanup()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith({ err: 'Error' }, 'Audit log retention failed');
    warn.mockRestore();
  });

  it('labels non-Error pruning failures without throwing', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const scheduler = new AuditLogRetentionScheduler({
      client_: { $queryRaw: vi.fn().mockRejectedValue('database unavailable') },
    } as never);

    await expect(scheduler.cleanup()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith({ err: 'UnknownError' }, 'Audit log retention failed');
    warn.mockRestore();
  });
});
