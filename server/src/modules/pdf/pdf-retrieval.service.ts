import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/postgresql-client/index.js';
import { PrismaPostgresqlService } from '@/prisma/prisma.service.js';
import { PdfEmbeddingService } from './pdf-embedding.service.js';

const MAX_RETRIEVED_CHUNKS = 8;

export interface IPdfRevisionSelection {
  sourceId: string;
  revision: number;
}

export interface IPdfRetrievedChunk {
  id: string;
  sourceId: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  similarity: number;
}

@Injectable()
export class PdfRetrievalService {
  constructor(
    private readonly postgres: PrismaPostgresqlService,
    private readonly embeddings: PdfEmbeddingService,
    private readonly config: ConfigService
  ) {}

  async retrieve(
    ownerId: string,
    selections: IPdfRevisionSelection[],
    query: string
  ): Promise<IPdfRetrievedChunk[]> {
    if (!selections.length) return [];
    const [vector] = await this.embeddings.embed([query], 'query');
    if (!vector) return [];
    const vectorLiteral = `[${vector.join(',')}]`;
    const rowsBySource = await Promise.all(
      selections.map(({ sourceId, revision }) =>
        this.postgres.withWorkerPdfContext(ownerId, sourceId, revision, (transaction) =>
          transaction.$queryRaw<IPdfRetrievedChunk[]>(Prisma.sql`
        SELECT "id", "sourceId", "pageStart", "pageEnd", "text",
               1 - ("embedding" <=> ${vectorLiteral}::vector) AS "similarity"
        FROM public."PdfChunk"
        WHERE "ownerId" = ${ownerId} AND "sourceId" = ${sourceId} AND "revision" = ${revision}
        ORDER BY "embedding" <=> ${vectorLiteral}::vector
        LIMIT ${MAX_RETRIEVED_CHUNKS}
      `)
        )
      )
    );

    const threshold = this.config.get<number>('PDF_SIMILARITY_THRESHOLD', 0.15);
    return rowsBySource
      .flat()
      .filter((row) => Number(row.similarity) >= threshold)
      .sort((left, right) => Number(right.similarity) - Number(left.similarity))
      .slice(0, MAX_RETRIEVED_CHUNKS);
  }
}
