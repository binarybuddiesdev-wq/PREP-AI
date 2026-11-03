import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PdfService } from './pdf.service.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { PdfStorageService } from './pdf-storage.service.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { createHash } from 'node:crypto';
import { createPdfUploadSourceId } from './pdf-upload-idempotency.js';
import { IDEMPOTENCY_KEY_REUSED } from '@/common/constants/api.constants.js';

describe('PdfService', () => {
  let service: PdfService;
  let prisma: { pdfSource: Record<string, ReturnType<typeof vi.fn>> };
  let storage: { upload: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let extractor: { extract: ReturnType<typeof vi.fn> };
  let jobs: { enqueue: ReturnType<typeof vi.fn> };
  let redis: { reserveQuota: ReturnType<typeof vi.fn>; releaseQuota: ReturnType<typeof vi.fn> };
  let config: { get: ReturnType<typeof vi.fn> };
  let uploadSequence = 0;

  beforeEach(async () => {
    prisma = {
      pdfSource: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    storage = { upload: vi.fn().mockResolvedValue('private-asset'), delete: vi.fn() };
    extractor = {
      extract: vi.fn().mockResolvedValue({ pageCount: 1, pages: [{ page: 1, text: 'text' }] }),
    };
    jobs = { enqueue: vi.fn().mockResolvedValue('queue-job') };
    redis = {
      reserveQuota: vi.fn().mockResolvedValue({ allowed: true, count: 1 }),
      releaseQuota: vi.fn().mockResolvedValue(undefined),
    };
    config = {
      get: vi.fn((_key: string, fallback?: unknown) => fallback),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: PrismaService, useValue: prisma },
        { provide: PdfStorageService, useValue: storage },
        { provide: PdfTextExtractor, useValue: extractor },
        { provide: JobQueueService, useValue: jobs },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
        {
          provide: 'PinoLogger:PdfService',
          useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        },
      ],
    }).compile();
    service = module.get(PdfService);
  });

  afterEach(() => vi.restoreAllMocks());

  const upload = (
    buffer: Buffer,
    filename: string,
    mimetype: string,
    userId: string,
    idempotencyKey = `test-upload-${++uploadSequence}`
  ) => service.upload(buffer, filename, mimetype, userId, idempotencyKey);

  const uploadSource = (buffer: Buffer, overrides: Record<string, unknown> = {}) => ({
    id: createPdfUploadSourceId('user_1', 'retry-key'),
    userId: 'user_1',
    displayName: 'notes.pdf',
    byteSize: buffer.length,
    contentHash: createHash('sha256').update(buffer).digest('hex'),
    assetId: 'private-asset',
    pageCount: 1,
    status: 'queued',
    activeRevision: 0,
    requestedRevision: 1,
    failureCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('replays a matching upload before parsing, quota, storage, or queue work', async () => {
    const buffer = Buffer.from('%PDF-1.7\nbody');
    prisma.pdfSource.findFirst.mockResolvedValueOnce(uploadSource(buffer));

    await expect(
      upload(buffer, 'notes.pdf', 'application/pdf', 'user_1', 'retry-key')
    ).resolves.toMatchObject({
      id: createPdfUploadSourceId('user_1', 'retry-key'),
      status: 'queued',
    });

    expect(extractor.extract).not.toHaveBeenCalled();
    expect(redis.reserveQuota).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a reused upload key when its file fingerprint changes', async () => {
    const original = Buffer.from('%PDF-1.7\noriginal');
    const changed = Buffer.from('%PDF-1.7\nchanged');
    prisma.pdfSource.findFirst.mockResolvedValueOnce(uploadSource(original));

    await expect(
      upload(changed, 'notes.pdf', 'application/pdf', 'user_1', 'retry-key')
    ).rejects.toBeInstanceOf(ConflictException);

    expect(extractor.extract).not.toHaveBeenCalled();
    expect(redis.reserveQuota).not.toHaveBeenCalled();
  });

  it('returns the winner of a concurrent duplicate-key insert and releases its reserved quota', async () => {
    const buffer = Buffer.from('%PDF-1.7\nbody');
    prisma.pdfSource.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(uploadSource(buffer));
    prisma.pdfSource.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate key'), { code: 'P2002' })
    );

    await expect(
      upload(buffer, 'notes.pdf', 'application/pdf', 'user_1', 'retry-key')
    ).resolves.toMatchObject({
      id: createPdfUploadSourceId('user_1', 'retry-key'),
      status: 'queued',
    });

    expect(redis.releaseQuota).toHaveBeenCalledOnce();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('replays a matching request when a concurrent upload fills the file-count quota', async () => {
    const buffer = Buffer.from('%PDF-1.7\nbody');
    prisma.pdfSource.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(uploadSource(buffer));
    prisma.pdfSource.findMany.mockResolvedValueOnce(Array(5).fill({ byteSize: 1 }));

    await expect(
      upload(buffer, 'notes.pdf', 'application/pdf', 'user_1', 'retry-key')
    ).resolves.toMatchObject({
      id: createPdfUploadSourceId('user_1', 'retry-key'),
      status: 'queued',
    });

    expect(redis.reserveQuota).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('returns the key-reuse conflict when a mismatched concurrent request hits a storage quota', async () => {
    const original = Buffer.from('%PDF-1.7\noriginal');
    const changed = Buffer.from('%PDF-1.7\nchanged');
    prisma.pdfSource.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(uploadSource(original));
    prisma.pdfSource.findMany.mockResolvedValueOnce(Array(5).fill({ byteSize: 1 }));

    await expect(
      upload(changed, 'notes.pdf', 'application/pdf', 'user_1', 'retry-key')
    ).rejects.toThrow(IDEMPOTENCY_KEY_REUSED);
  });

  it('replays a matching request when its concurrent upload takes the final daily quota slot', async () => {
    const buffer = Buffer.from('%PDF-1.7\nbody');
    prisma.pdfSource.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(uploadSource(buffer));
    redis.reserveQuota.mockResolvedValueOnce({ allowed: false });

    await expect(
      upload(buffer, 'notes.pdf', 'application/pdf', 'user_1', 'retry-key')
    ).resolves.toMatchObject({
      id: createPdfUploadSourceId('user_1', 'retry-key'),
      status: 'queued',
    });

    expect(prisma.pdfSource.create).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects bad files before parsing, reserving quota, or uploading', async () => {
    await expect(
      upload(Buffer.from('not pdf'), 'notes.pdf', 'application/pdf', 'user_1')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(extractor.extract).not.toHaveBeenCalled();
    expect(redis.reserveQuota).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('maps parser failures to safe client-facing messages', async () => {
    extractor.extract.mockRejectedValueOnce(new Error('PDF contains no extractable text'));
    await expect(upload(Buffer.from('%PDF-1'), 'scan.pdf', 'application/pdf', 'u')).rejects.toThrow(
      'Scanned PDFs are not supported yet'
    );
    extractor.extract.mockRejectedValueOnce(new Error('PDF exceeds the extracted text limit'));
    await expect(
      upload(Buffer.from('%PDF-1'), 'large.pdf', 'application/pdf', 'u')
    ).rejects.toThrow('PDF contains too much extractable text');
    extractor.extract.mockRejectedValueOnce(new Error('PDF exceeds the 100 page limit'));
    await expect(upload(Buffer.from('%PDF-1'), 'many.pdf', 'application/pdf', 'u')).rejects.toThrow(
      'PDF exceeds the 100 page limit'
    );
    extractor.extract.mockRejectedValueOnce(new Error('PDF page limit must be a positive integer'));
    await expect(upload(Buffer.from('%PDF-1'), 'many.pdf', 'application/pdf', 'u')).rejects.toThrow(
      'PDF page limit must be a positive integer'
    );
    extractor.extract.mockRejectedValueOnce(new Error('corrupt internals'));
    await expect(upload(Buffer.from('%PDF-1'), 'bad.pdf', 'application/pdf', 'u')).rejects.toThrow(
      'PDF could not be parsed. Check that the file is a valid, unencrypted PDF.'
    );
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('enforces file-count and storage-byte quotas before reserving daily uploads', async () => {
    prisma.pdfSource.findMany.mockResolvedValueOnce(Array(5).fill({ byteSize: 1 }));
    await expect(
      upload(Buffer.from('%PDF-1'), 'a.pdf', 'application/pdf', 'u')
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.pdfSource.findMany.mockResolvedValueOnce([{ byteSize: 50 * 1024 * 1024 }]);
    await expect(upload(Buffer.from('%PDF-1'), 'b.pdf', 'application/pdf', 'u')).rejects.toThrow(
      'PDF storage limit reached'
    );
    expect(redis.reserveQuota).not.toHaveBeenCalled();
  });

  it('rejects daily quota exhaustion and maps Redis failures to service unavailable', async () => {
    redis.reserveQuota.mockResolvedValueOnce({ allowed: false });
    await expect(
      upload(Buffer.from('%PDF-1'), 'a.pdf', 'application/pdf', 'u')
    ).rejects.toBeInstanceOf(ConflictException);
    redis.reserveQuota.mockRejectedValueOnce(new Error('redis offline'));
    await expect(
      upload(Buffer.from('%PDF-1'), 'a.pdf', 'application/pdf', 'u')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('persists source ownership and queues only IDs after private upload', async () => {
    const source = {
      id: 'source_1',
      userId: 'user_1',
      displayName: 'notes.pdf',
      byteSize: 13,
      contentHash: 'hash',
      assetId: 'private-asset',
      pageCount: 1,
      status: 'queued',
      activeRevision: 0,
      requestedRevision: 1,
      failureCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.pdfSource.create.mockResolvedValue({ ...source, status: 'uploading', assetId: null });
    prisma.pdfSource.update.mockResolvedValue(source);

    const result = await upload(
      Buffer.from('%PDF-1.7\nbody'),
      'notes.pdf',
      'application/pdf',
      'user_1',
      'source-key'
    );

    expect(result).toMatchObject({ id: 'source_1', status: 'queued', displayName: 'notes.pdf' });
    expect(result).not.toHaveProperty('assetId');
    expect(prisma.pdfSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: createPdfUploadSourceId('user_1', 'source-key'),
          userId: 'user_1',
          status: 'uploading',
        }),
      })
    );
    expect(jobs.enqueue).toHaveBeenCalledWith(
      'pdf-ingest-queue',
      { idempotencyKey: 'pdf:source_1:1', sourceId: 'source_1', revision: 1 },
      'ingest'
    );
  });

  it('keeps a queued source recoverable when Redis enqueue is unavailable', async () => {
    prisma.pdfSource.create.mockResolvedValue({ id: 'source_2' });
    prisma.pdfSource.update.mockResolvedValue({
      id: 'source_2',
      userId: 'user_1',
      displayName: 'notes.pdf',
      byteSize: 13,
      pageCount: 1,
      status: 'queued',
      activeRevision: 0,
      requestedRevision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jobs.enqueue.mockRejectedValue(new ServiceUnavailableException());

    await expect(
      upload(Buffer.from('%PDF-1.7\nbody'), 'notes.pdf', 'application/pdf', 'user_1')
    ).resolves.toMatchObject({ status: 'queued' });
  });

  it('cleans up the asset and releases quota when metadata finalization fails', async () => {
    prisma.pdfSource.create.mockResolvedValue({ id: 'source_3' });
    prisma.pdfSource.update
      .mockRejectedValueOnce(new Error('Mongo unavailable'))
      .mockResolvedValueOnce(undefined);
    storage.delete.mockResolvedValue(undefined);
    await expect(
      upload(Buffer.from('%PDF-1'), 'a.pdf', 'application/pdf', 'u')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(storage.delete).toHaveBeenCalledWith('private-asset');
    expect(redis.releaseQuota).toHaveBeenCalled();
  });

  it('releases reserved upload quota when Cloudinary upload fails before returning an asset ID', async () => {
    prisma.pdfSource.create.mockResolvedValue({ id: 'source_4' });
    prisma.pdfSource.update.mockResolvedValue(undefined);
    storage.upload.mockRejectedValueOnce(new Error('cloudinary offline'));
    await expect(
      upload(Buffer.from('%PDF-1'), 'a.pdf', 'application/pdf', 'u')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(redis.releaseQuota).toHaveBeenCalledOnce();
  });

  it('returns bounded source lists and hides deleted sources', async () => {
    prisma.pdfSource.findMany.mockResolvedValueOnce([]);
    await expect(service.list('u', 500)).resolves.toEqual([]);
    expect(prisma.pdfSource.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    await service.list('u', 0);
    expect(prisma.pdfSource.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 })
    );
  });

  it('returns only the caller-owned non-deleted source', async () => {
    prisma.pdfSource.findFirst.mockResolvedValueOnce(null);
    await expect(service.get('source_1', 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks owned sources deleting and tolerates queue outage for reconciliation', async () => {
    prisma.pdfSource.findFirst.mockResolvedValue({
      id: 'source_1',
      status: 'ready',
      activeRevision: 2,
    });
    prisma.pdfSource.updateMany.mockResolvedValue({ count: 1 });
    jobs.enqueue.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.delete('source_1', 'u')).resolves.toEqual({
      id: 'source_1',
      status: 'deleting',
    });
    expect(prisma.pdfSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'deleting', dispatchNeeded: true }),
      })
    );
  });

  it('returns 404 for missing or already-deleted sources', async () => {
    prisma.pdfSource.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'x', status: 'deleted' });
    await expect(service.delete('x', 'u')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.delete('x', 'u')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('queues a new revision for reindexing without replacing the active revision early', async () => {
    prisma.pdfSource.findFirst.mockResolvedValue({
      id: 'source_1',
      userId: 'user_1',
      status: 'ready',
      activeRevision: 2,
      requestedRevision: 2,
      assetId: 'private-asset',
    });
    prisma.pdfSource.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.reindex('source_1', 'user_1')).resolves.toEqual({
      id: 'source_1',
      status: 'queued',
      requestedRevision: 3,
    });
    expect(prisma.pdfSource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestedRevision: 3, dispatchNeeded: true }),
      })
    );
    expect(jobs.enqueue).toHaveBeenCalledWith(
      'pdf-ingest-queue',
      { idempotencyKey: 'pdf:source_1:3', sourceId: 'source_1', revision: 3 },
      'ingest'
    );
  });

  it('rejects reindexing missing, unavailable, or concurrently changed sources', async () => {
    prisma.pdfSource.findFirst.mockResolvedValueOnce(null);
    await expect(service.reindex('x', 'u')).rejects.toBeInstanceOf(NotFoundException);
    prisma.pdfSource.findFirst.mockResolvedValueOnce({ id: 'x', status: 'ready', assetId: null });
    await expect(service.reindex('x', 'u')).rejects.toBeInstanceOf(ConflictException);
    prisma.pdfSource.findFirst.mockResolvedValueOnce({
      id: 'x',
      status: 'ready',
      assetId: 'asset',
      requestedRevision: 1,
    });
    prisma.pdfSource.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.reindex('x', 'u')).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps reindex recoverable when enqueue fails', async () => {
    prisma.pdfSource.findFirst.mockResolvedValue({
      id: 'source_1',
      status: 'failed',
      assetId: 'asset',
      requestedRevision: 3,
    });
    prisma.pdfSource.updateMany.mockResolvedValue({ count: 1 });
    jobs.enqueue.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.reindex('source_1', 'u')).resolves.toMatchObject({ requestedRevision: 4 });
  });

  it('claims and dispatches queued and deleting sources, leaving failed claims untouched', async () => {
    prisma.pdfSource.findMany.mockResolvedValueOnce([
      {
        id: 'queued',
        status: 'queued',
        requestedRevision: 2,
        activeRevision: 1,
        dispatchNeeded: true,
      },
      {
        id: 'deleting',
        status: 'deleting',
        requestedRevision: 2,
        activeRevision: 1,
        dispatchNeeded: true,
      },
    ]);
    prisma.pdfSource.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    await service.dispatchRecoverableSources();
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
    expect(jobs.enqueue).toHaveBeenCalledWith(
      'pdf-ingest-queue',
      { idempotencyKey: 'pdf:queued:2', sourceId: 'queued', revision: 2 },
      'ingest'
    );
  });

  it('dispatches delete jobs using the active revision and preserves recovery state when enqueue fails', async () => {
    prisma.pdfSource.findMany.mockResolvedValueOnce([
      {
        id: 'deleting',
        status: 'deleting',
        requestedRevision: 4,
        activeRevision: 3,
        dispatchNeeded: true,
      },
    ]);
    prisma.pdfSource.updateMany.mockResolvedValue({ count: 1 });
    jobs.enqueue.mockRejectedValueOnce(new Error('redis down'));
    await service.dispatchRecoverableSources();
    expect(jobs.enqueue).toHaveBeenCalledWith(
      'pdf-ingest-queue',
      { idempotencyKey: 'pdf-delete:deleting', sourceId: 'deleting', revision: 3 },
      'delete'
    );
    expect(prisma.pdfSource.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dispatchClaimId: null, dispatchClaimedAt: null }),
      })
    );
  });
});
