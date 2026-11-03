import { Module } from '@nestjs/common';
import { JobQueueModule } from '@/common/jobs/job-queue.module.js';
import { PdfController } from './pdf.controller.js';
import { PdfService } from './pdf.service.js';
import { PdfStorageService } from './pdf-storage.service.js';
import { PdfTextExtractor } from './pdf-text-extractor.js';
import { PdfEmbeddingService } from './pdf-embedding.service.js';
import { PdfIndexingService } from './pdf-indexing.service.js';
import { PdfIngestionWorker } from './pdf-ingestion.worker.js';
import { PdfStudyGenerationWorker } from './pdf-study-generation.worker.js';
import { PdfRetrievalService } from './pdf-retrieval.service.js';
import { PdfQuestionGeneratorService } from './pdf-question-generator.service.js';
import { PdfStudyGenerationService } from './pdf-study-generation.service.js';

@Module({
  imports: [JobQueueModule],
  controllers: [PdfController],
  providers: [
    PdfService,
    PdfStorageService,
    PdfTextExtractor,
    PdfEmbeddingService,
    PdfIndexingService,
    PdfRetrievalService,
    PdfQuestionGeneratorService,
    PdfStudyGenerationService,
    PdfIngestionWorker,
    PdfStudyGenerationWorker,
  ],
})
export class PdfModule {}
