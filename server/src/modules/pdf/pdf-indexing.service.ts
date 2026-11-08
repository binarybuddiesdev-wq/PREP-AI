import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService, PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { PdfStorageService } from './pdf-storage.service.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';
import { PDF_EMBEDDING_MODEL, PdfEmbeddingService } from './pdf-embedding.service.js';
import { chunkPdfPages } from './pdf-chunker.js';

const MAX_CHUNKS_PER_PDF = 1000;

@Injectable()
export class PdfIndexingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postgres: PrismaPostgresqlService,
    private readonly storage: PdfStorageService,
    private readonly extractor: PdfTextExtractor,
    private readonly embeddings: PdfEmbeddingService,
    private readonly config: ConfigService
  ) {}

  async ingest(sourceId: string, revision: number): Promise<void> {
    const source = await this.prisma.pdfSource.findUnique({ where: { id: sourceId } });
    if (
      !source ||
      !source.assetId ||
      source.status === 'deleting' ||
      source.status === 'deleted' ||
      source.requestedRevision !== revision ||
      (source.status === 'ready' && source.activeRevision === revision)
    ) {
      return;
    }

    const claim = await this.prisma.pdfSource.updateMany({
      where: {
        id: sourceId,
        userId: source.userId,
        requestedRevision: revision,
        status: { in: ['queued', 'processing', 'ready', 'failed'] },
      },
      data: { status: 'processing', failureCode: null, dispatchNeeded: false },
    });
    if (!claim.count) return;

    const maxBytes = this.config.get<number>('PDF_MAX_FILE_BYTES', 10 * 1024 * 1024);
    const buffer = await this.storage.download(source.assetId, maxBytes);
    const extraction = await this.extractor.extract(
      buffer,
      this.config.get<number>('PDF_MAX_PAGES', 400),
      this.config.get<number>('PDF_MAX_EXTRACTED_CHARS', 1_000_000)
    );
    const chunks = chunkPdfPages(extraction.pages, {
      size: this.config.get<number>('PDF_CHUNK_SIZE', 512),
      overlap: this.config.get<number>('PDF_CHUNK_OVERLAP', 64),
    });
    if (!chunks.length) throw new Error('PDF contains no extractable text');
    if (chunks.length > MAX_CHUNKS_PER_PDF) throw new Error('PDF exceeds the chunk limit');

    const vectors = await this.embeddings.embed(
      chunks.map((chunk) => chunk.text),
      'passage'
    );
    if (vectors.length !== chunks.length)
      throw new Error('Embedding count does not match PDF chunks');

    await this.postgres.withWorkerPdfContext(
      source.userId,
      source.id,
      revision,
      async (transaction) => {
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index]!;
          const vector = vectors[index]!;
          const chunkId = createHash('sha256')
            .update(`${source.userId}:${source.id}:${revision}:${chunk.chunkIndex}`)
            .digest('hex');
          const contentHash = createHash('sha256').update(chunk.text).digest('hex');
          await transaction.$executeRaw`
          INSERT INTO public."PdfChunk"
            ("id", "ownerId", "sourceId", "revision", "chunkIndex", "pageStart", "pageEnd", "text", "contentHash", "embeddingModel", "embedding", "createdAt")
          VALUES
            (${chunkId}, ${source.userId}, ${source.id}, ${revision}, ${chunk.chunkIndex}, ${chunk.pageStart}, ${chunk.pageEnd}, ${chunk.text}, ${contentHash}, ${PDF_EMBEDDING_MODEL}, ${`[${vector.join(',')}]`}::vector, NOW())
          ON CONFLICT ("ownerId", "sourceId", "revision", "chunkIndex") DO UPDATE SET
            "pageStart" = EXCLUDED."pageStart",
            "pageEnd" = EXCLUDED."pageEnd",
            "text" = EXCLUDED."text",
            "contentHash" = EXCLUDED."contentHash",
            "embeddingModel" = EXCLUDED."embeddingModel",
            "embedding" = EXCLUDED."embedding"
        `;
        }
      }
    );

    const activated = await this.prisma.pdfSource.updateMany({
      where: {
        id: source.id,
        userId: source.userId,
        requestedRevision: revision,
        status: { in: ['processing', 'ready'] },
      },
      data: { status: 'ready', activeRevision: revision, failureCode: null, dispatchNeeded: false },
    });
    if (!activated.count) {
      await this.deleteRevision(source.userId, source.id, revision);
      return;
    }

    for (let oldRevision = 1; oldRevision < revision; oldRevision += 1) {
      await this.deleteRevision(source.userId, source.id, oldRevision);
    }
  }

  async markFailed(
    sourceId: string,
    revision: number,
    failureCode = 'ingestion_failed'
  ): Promise<void> {
    const source = await this.prisma.pdfSource.findUnique({ where: { id: sourceId } });
    if (!source) return;
    const hasActiveRevision = source.activeRevision > 0;
    await this.prisma.pdfSource.updateMany({
      where: {
        id: sourceId,
        requestedRevision: revision,
        status: { notIn: ['deleting', 'deleted'] },
      },
      data: {
        status: hasActiveRevision ? 'ready' : 'failed',
        failureCode: hasActiveRevision ? 'reindex_failed' : failureCode,
      },
    });
  }

  async delete(sourceId: string): Promise<void> {
    const source = await this.prisma.pdfSource.findUnique({ where: { id: sourceId } });
    if (!source || source.status === 'deleted') return;

    const revisions = new Set<number>([source.activeRevision, source.requestedRevision]);
    for (const revision of revisions) {
      if (revision > 0) await this.deleteRevision(source.userId, source.id, revision);
    }
    if (source.assetId) await this.storage.delete(source.assetId);
    await this.prisma.pdfSource.updateMany({
      where: { id: source.id, status: 'deleting' },
      data: {
        status: 'deleted',
        assetId: null,
        dispatchNeeded: false,
        dispatchClaimId: null,
        dispatchClaimedAt: null,
      },
    });
  }

  private async deleteRevision(ownerId: string, sourceId: string, revision: number): Promise<void> {
    await this.postgres.withWorkerPdfContext(
      ownerId,
      sourceId,
      revision,
      (transaction) =>
        transaction.$executeRaw`
        DELETE FROM public."PdfChunk"
        WHERE "ownerId" = ${ownerId} AND "sourceId" = ${sourceId} AND "revision" = ${revision}
      `
    );
  }
}
