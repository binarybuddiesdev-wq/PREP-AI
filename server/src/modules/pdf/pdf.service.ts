import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service.js';
import { RedisService } from '@/common/redis/redis.service.js';
import { JobQueueService } from '@/common/jobs/job-queue.service.js';
import { JOB_QUEUE_NAMES } from '@/common/jobs/job-queue.constants.js';
import { PdfStorageService } from './pdf-storage.service.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';
import { validatePdfUpload } from './pdf-upload.validation.js';
import {
  createIdempotencyOperationId,
  createIdempotencyRequestFingerprint,
  requireIdempotencyKey,
} from '@/common/idempotency/index.js';
import { createPdfUploadSourceId } from './pdf-upload-idempotency.js';
import { IDEMPOTENCY_KEY_REUSED } from '@/common/constants/api.constants.js';

const ACTIVE_STATUSES = ['uploading', 'queued', 'processing', 'ready', 'deleting'];
const MAX_LIST_LIMIT = 50;
const MAX_PDF_REINDEX_OPERATIONS = 100;

interface IPdfReindexOperation {
  operationId: string;
  requestFingerprint: string;
  requestedRevision: number;
}

interface IPdfUploadReplaySource {
  id: string;
  userId: string;
  displayName: string;
  byteSize: number;
  contentHash: string;
  pageCount: number | null;
  status: string;
  activeRevision: number;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PdfStorageService,
    private readonly extractor: PdfTextExtractor,
    private readonly jobs: JobQueueService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @InjectPinoLogger(PdfService.name) private readonly logger: PinoLogger
  ) {}

  async upload(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    userId: string,
    idempotencyKey: string
  ) {
    const maxBytes = this.config.get<number>('PDF_MAX_FILE_BYTES', 10 * 1024 * 1024);
    const { displayName, byteSize } = validatePdfUpload(buffer, filename, mimetype, maxBytes);
    const key = requireIdempotencyKey(idempotencyKey);
    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const sourceId = createPdfUploadSourceId(userId, key);
    const fingerprint = { displayName, byteSize, contentHash };
    const existing = await this.findMatchingUpload(sourceId, userId, fingerprint);
    if (existing) return existing;

    const maxPages = this.config.get<number>('PDF_MAX_PAGES', 400);
    let extraction;
    try {
      extraction = await this.extractor.extract(
        buffer,
        maxPages,
        this.config.get<number>('PDF_MAX_EXTRACTED_CHARS', 1_000_000)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'PDF contains no extractable text') {
        throw new BadRequestException(
          'This PDF has no selectable text. Scanned PDFs are not supported yet.'
        );
      }
      if (message === 'PDF exceeds the extracted text limit') {
        throw new BadRequestException('PDF contains too much extractable text');
      }
      if (
        message.startsWith('PDF exceeds the ') ||
        message === 'PDF page limit must be a positive integer'
      ) {
        throw new BadRequestException(message);
      }
      throw new BadRequestException(
        'PDF could not be parsed. Check that the file is a valid, unencrypted PDF.'
      );
    }

    try {
      await this.enforceStorageQuota(userId, byteSize);
    } catch (error) {
      const concurrent = await this.findMatchingUpload(sourceId, userId, fingerprint);
      if (concurrent) return concurrent;
      throw error;
    }
    const quotaKey = this.dailyUploadQuotaKey(userId);
    try {
      const quota = await this.redis.reserveQuota(
        quotaKey,
        this.config.get<number>('PDF_DAILY_UPLOADS_PER_USER', 9),
        this.secondsUntilUtcMidnight()
      );
      if (!quota.allowed) throw new ConflictException('Daily PDF upload limit reached');
    } catch (error) {
      const concurrent = await this.findMatchingUpload(sourceId, userId, fingerprint);
      if (concurrent) return concurrent;
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('PDF upload quota service is temporarily unavailable', {
        cause: error,
      });
    }

    let source: Awaited<ReturnType<PrismaService['pdfSource']['create']>> | undefined;
    let assetId: string | undefined;
    try {
      source = await this.prisma.pdfSource.create({
        data: {
          id: sourceId,
          userId,
          displayName,
          byteSize,
          contentHash,
          pageCount: extraction.pageCount,
          status: 'uploading',
          activeRevision: 0,
          requestedRevision: 1,
        },
      });
      assetId = await this.storage.upload(buffer, source.id);
      const queued = await this.prisma.pdfSource.update({
        where: { id: source.id },
        data: { assetId, status: 'queued', failureCode: null, dispatchNeeded: true },
      });

      try {
        await this.jobs.enqueue(
          JOB_QUEUE_NAMES.PDF_INGESTION,
          {
            idempotencyKey: `pdf:${source.id}:1`,
            sourceId: source.id,
            revision: 1,
          },
          'ingest'
        );
      } catch (error) {
        this.logger.warn(
          { sourceId: source.id, errorName: error instanceof Error ? error.name : 'UnknownError' },
          'PDF source persisted as queued; worker reconciliation will dispatch it'
        );
      }
      return this.toPublicSource(queued);
    } catch (error) {
      if (!source && this.isDuplicateKeyError(error)) {
        await this.redis.releaseQuota(quotaKey).catch(() => undefined);
        const concurrent = await this.findMatchingUpload(sourceId, userId, fingerprint);
        if (concurrent) return concurrent;
        throw new ConflictException('PDF upload key conflicts with an existing source');
      }
      if (source) {
        await this.prisma.pdfSource
          .update({
            where: { id: source.id },
            data: { status: 'failed', failureCode: 'storage_upload_failed' },
          })
          .catch(() => undefined);
      }
      if (assetId) await this.storage.delete(assetId).catch(() => undefined);
      await this.redis.releaseQuota(quotaKey).catch(() => undefined);
      throw error instanceof ServiceUnavailableException
        ? error
        : new ServiceUnavailableException('PDF upload could not be completed', { cause: error });
    }
  }

  private replayUpload(
    source: IPdfUploadReplaySource,
    userId: string,
    fingerprint: { displayName: string; byteSize: number; contentHash: string }
  ) {
    if (
      source.userId !== userId ||
      source.displayName !== fingerprint.displayName ||
      source.byteSize !== fingerprint.byteSize ||
      source.contentHash !== fingerprint.contentHash
    ) {
      throw new ConflictException(IDEMPOTENCY_KEY_REUSED);
    }
    return this.toPublicSource(source);
  }

  private async findMatchingUpload(
    sourceId: string,
    userId: string,
    fingerprint: { displayName: string; byteSize: number; contentHash: string }
  ) {
    const source = await this.prisma.pdfSource.findFirst({ where: { id: sourceId, userId } });
    return source ? this.replayUpload(source, userId, fingerprint) : undefined;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  async list(userId: string, limit = 20) {
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), MAX_LIST_LIMIT);
    const sources = await this.prisma.pdfSource.findMany({
      where: { userId, status: { notIn: ['deleted'] } },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
    return sources.map((source) => this.toPublicSource(source));
  }

  async get(sourceId: string, userId: string) {
    const source = await this.prisma.pdfSource.findFirst({
      where: { id: sourceId, userId, status: { not: 'deleted' } },
    });
    if (!source) throw new NotFoundException('PDF source not found');
    return this.toPublicSource(source);
  }

  async getContent(sourceId: string, userId: string): Promise<Buffer> {
    const source = await this.prisma.pdfSource.findFirst({
      where: { id: sourceId, userId, status: { not: 'deleted' } },
    });
    if (!source) throw new NotFoundException('PDF source not found');
    if (source.status !== 'ready' || !source.assetId) {
      throw new ConflictException('PDF source is not ready for preview');
    }

    return this.storage.download(
      source.assetId,
      this.config.get<number>('PDF_MAX_FILE_BYTES', 10 * 1024 * 1024)
    );
  }

  async reindex(sourceId: string, userId: string, idempotencyKey: string | undefined) {
    const key = requireIdempotencyKey(idempotencyKey);
    const operationId = createIdempotencyOperationId(userId, `pdf-reindex:${sourceId}`, key);
    const requestFingerprint = createIdempotencyRequestFingerprint('pdf-reindex', { sourceId });
    const source = await this.prisma.pdfSource.findFirst({ where: { id: sourceId, userId } });
    if (!source) {
      throw new NotFoundException('PDF source not found or cannot be reindexed');
    }

    const existingOperation = this.findReindexOperation(source.reindexOperations, operationId);
    if (existingOperation)
      return this.replayReindex(sourceId, existingOperation, requestFingerprint);
    if (source.status === 'deleted') {
      throw new NotFoundException('PDF source not found or cannot be reindexed');
    }
    if (!['ready', 'failed'].includes(source.status)) {
      throw new NotFoundException('PDF source not found or cannot be reindexed');
    }
    if (!source.assetId)
      throw new ConflictException('PDF source file is unavailable for reindexing');

    const revision = source.requestedRevision + 1;
    const operations = this.readReindexOperations(source.reindexOperations);
    const nextOperation: IPdfReindexOperation = {
      operationId,
      requestFingerprint,
      requestedRevision: revision,
    };
    const updated = await this.prisma.pdfSource.updateMany({
      where: {
        id: source.id,
        userId,
        status: source.status,
        requestedRevision: source.requestedRevision,
      },
      data: {
        requestedRevision: revision,
        dispatchNeeded: true,
        failureCode: null,
        reindexOperations: [...operations, nextOperation].slice(
          -MAX_PDF_REINDEX_OPERATIONS
        ) as unknown as Prisma.InputJsonValue,
      },
    });
    if (!updated.count) {
      const concurrentSource = await this.prisma.pdfSource.findFirst({
        where: { id: sourceId, userId },
      });
      if (!concurrentSource || concurrentSource.status === 'deleted') {
        throw new NotFoundException('PDF source not found or cannot be reindexed');
      }
      const concurrentOperation = this.findReindexOperation(
        concurrentSource.reindexOperations,
        operationId
      );
      if (concurrentOperation) {
        return this.replayReindex(sourceId, concurrentOperation, requestFingerprint);
      }
      throw new ConflictException('PDF source changed; retry the reindex request');
    }

    try {
      await this.jobs.enqueue(
        JOB_QUEUE_NAMES.PDF_INGESTION,
        { idempotencyKey: `pdf:${source.id}:${revision}`, sourceId: source.id, revision },
        'ingest'
      );
    } catch (error) {
      this.logger.warn(
        {
          sourceId: source.id,
          revision,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        },
        'PDF reindex persisted; worker reconciliation will dispatch it'
      );
    }
    return { id: source.id, status: 'queued' as const, requestedRevision: revision };
  }

  private readReindexOperations(value: unknown): IPdfReindexOperation[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (operation): operation is IPdfReindexOperation =>
        typeof operation === 'object' &&
        operation !== null &&
        'operationId' in operation &&
        typeof operation.operationId === 'string' &&
        'requestFingerprint' in operation &&
        typeof operation.requestFingerprint === 'string' &&
        'requestedRevision' in operation &&
        typeof operation.requestedRevision === 'number'
    );
  }

  private findReindexOperation(value: unknown, operationId: string) {
    return this.readReindexOperations(value).find(
      (operation) => operation.operationId === operationId
    );
  }

  private replayReindex(
    sourceId: string,
    operation: IPdfReindexOperation,
    requestFingerprint: string
  ) {
    if (operation.requestFingerprint !== requestFingerprint) {
      throw new ConflictException(IDEMPOTENCY_KEY_REUSED);
    }
    return {
      id: sourceId,
      status: 'queued' as const,
      requestedRevision: operation.requestedRevision,
    };
  }

  async delete(sourceId: string, userId: string) {
    const source = await this.prisma.pdfSource.findFirst({ where: { id: sourceId, userId } });
    if (!source) throw new NotFoundException('PDF source not found');
    if (source.status === 'deleted') return { id: source.id, status: 'deleted' as const };
    if (source.status !== 'deleting') {
      await this.prisma.pdfSource.updateMany({
        where: { id: source.id, userId, status: { not: 'deleted' } },
        data: { status: 'deleting', deletedAt: new Date(), dispatchNeeded: true },
      });
    }
    try {
      await this.jobs.enqueue(
        JOB_QUEUE_NAMES.PDF_INGESTION,
        {
          idempotencyKey: `pdf-delete:${source.id}`,
          sourceId: source.id,
          revision: source.activeRevision,
        },
        'delete'
      );
    } catch (error) {
      this.logger.warn(
        { sourceId: source.id, errorName: error instanceof Error ? error.name : 'UnknownError' },
        'PDF deletion persisted; worker reconciliation will dispatch cleanup'
      );
    }
    return { id: source.id, status: 'deleting' as const };
  }

  async dispatchRecoverableSources(): Promise<void> {
    const sources = await this.prisma.pdfSource.findMany({
      where: {
        OR: [{ status: 'queued' }, { dispatchNeeded: true }, { status: 'deleting' }],
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });

    for (const source of sources) {
      const claimId = randomUUID();
      const claim = await this.prisma.pdfSource.updateMany({
        where: {
          id: source.id,
          status: source.status,
          dispatchNeeded: source.dispatchNeeded,
          OR: [
            { dispatchClaimedAt: null },
            { dispatchClaimedAt: { lt: new Date(Date.now() - 30_000) } },
          ],
        },
        data: { dispatchClaimId: claimId, dispatchClaimedAt: new Date() },
      });
      if (!claim.count) continue;

      const isDelete = source.status === 'deleting';
      let enqueued = false;
      try {
        await this.jobs.enqueue(
          JOB_QUEUE_NAMES.PDF_INGESTION,
          {
            idempotencyKey: isDelete
              ? `pdf-delete:${source.id}`
              : `pdf:${source.id}:${source.requestedRevision}`,
            sourceId: source.id,
            revision: isDelete ? source.activeRevision : source.requestedRevision,
          },
          isDelete ? 'delete' : 'ingest'
        );
        enqueued = true;
      } catch (error) {
        this.logger.warn(
          { sourceId: source.id, errorName: error instanceof Error ? error.name : 'UnknownError' },
          'PDF queue dispatch failed; source lease will expire for retry'
        );
      } finally {
        await this.prisma.pdfSource
          .updateMany({
            where: { id: source.id, dispatchClaimId: claimId },
            data: {
              dispatchClaimId: null,
              dispatchClaimedAt: null,
              ...(!isDelete && enqueued ? { dispatchNeeded: false } : {}),
            },
          })
          .catch(() => undefined);
      }
    }
  }

  private async enforceStorageQuota(userId: string, incomingBytes: number): Promise<void> {
    const sources = await this.prisma.pdfSource.findMany({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      select: { byteSize: true },
    });
    if (sources.length >= this.config.get<number>('PDF_MAX_FILES_PER_USER', 10)) {
      throw new ConflictException('PDF file limit reached');
    }
    const currentBytes = sources.reduce((total, source) => total + source.byteSize, 0);
    const maximum = this.config.get<number>('PDF_MAX_STORAGE_BYTES_PER_USER', 50 * 1024 * 1024);
    if (currentBytes + incomingBytes > maximum) {
      throw new ConflictException('PDF storage limit reached');
    }
  }

  private dailyUploadQuotaKey(userId: string): string {
    return `quota:${userId}:${new Date().toISOString().slice(0, 10)}:pdf_uploads`;
  }

  private secondsUntilUtcMidnight(): number {
    const now = new Date();
    const midnight = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
    return Math.max(1, Math.ceil((midnight.getTime() + 86_400_000 - now.getTime()) / 1000));
  }

  private toPublicSource(source: {
    id: string;
    displayName: string;
    byteSize: number;
    pageCount: number | null;
    status: string;
    activeRevision: number;
    failureCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: source.id,
      displayName: source.displayName,
      byteSize: source.byteSize,
      pageCount: source.pageCount,
      status: source.status,
      activeRevision: source.activeRevision,
      failureCode: source.failureCode,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }
}
