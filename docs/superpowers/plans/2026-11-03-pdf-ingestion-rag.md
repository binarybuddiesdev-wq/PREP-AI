# PDF Ingestion and RAG Implementation Plan

> **For agentic workers:** Execute natively in this session, one task at a time, using TDD. Each task must have a failing test before its production implementation.

**Goal:** Add authenticated PDF upload, durable asynchronous extraction/indexing, owner-scoped retrieval, and PDF-grounded theory questions using the approved design.

**Architecture:** Keep upload API and metadata in the existing NestJS/Mongo layers, store originals as authenticated Cloudinary raw assets, and process jobs with BullMQ workers. Extract pages with Mozilla PDF.js, store 1024-dimensional embeddings in PostgreSQL/pgvector behind RLS, and generate structured questions through Mastra.

**Tech Stack:** NestJS/Fastify, Prisma MongoDB and PostgreSQL clients, BullMQ/Redis, Cloudinary Node SDK, `pdfjs-dist`, PostgreSQL pgvector, Mastra, Vitest.

**Spec:** [PDF ingestion and RAG design](../specs/2026-11-03-pdf-ingestion-rag-design.md)

## Global Constraints

- One PDF per upload, maximum 10 MiB and 100 pages; 5 active PDFs/50 MiB and 3 uploads per user per UTC day as configurable defaults.
- Text PDFs only; scanned/image-only PDFs must fail with a stable `unsupported_ocr` status.
- Every API PDF lookup includes the Clerk owner; queue payloads contain only stable IDs and revisions.
- Original files are authenticated Cloudinary raw assets; no public URLs or transient signed URLs are persisted.
- Every PostgreSQL vector query is owner/source/revision filtered and protected by RLS; runtime roles must not bypass RLS.
- Chunk at 512 tokens with up to 64 overlap, page-bounded; begin retrieval at top 8 with a configurable 0.7 similarity floor.
- Embedding model is `nvidia/nemotron-3.5-embed-1b`, requested at 1024 dimensions to match pgvector; verify service availability at runtime and fail closed if unavailable.
- User-visible response envelope and existing `api/v1` routes/auth/error handling are preserved.

## Review Focus

- Malformed, encrypted, over-limit, and image-only PDFs: stable client errors; no provider/storage work before validation.
- Duplicate upload/job and API/worker restart: idempotent source revision and redispatch without duplicate chunks.
- Cross-user source IDs, chunks, citations, and worker jobs: no data access or disclosure.
- Cloudinary signed/authenticated download failure and partial upload: bounded cleanup/retry; no public asset.
- Provider timeout, invalid vector dimension, weak retrieval, and invented citations: durable failure/insufficient-material state, never unsupported questions.

---

## File Structure

- `server/src/modules/pdf/`: PDF controller, service, DTOs, persistence adapters, Cloudinary adapter, PDF.js extractor, chunker, embedding adapter, retrieval, worker, and focused tests.
- `server/prisma/schema.prisma`: Mongo `PdfSource` metadata.
- `server/prisma/schema.postgresql.prisma`: theory PDF generation fields and `PdfChunk` vector row model.
- `server/prisma/rls/002-pdf-rag.sql`: pgvector setup, vector table migration, scoped worker helpers, grants, and forced RLS policies.
- `server/src/common/jobs/`: generation queue and job policy.
- `server/src/modules/theory/`: PDF mode input validation, async generation request/status behavior, and tests.
- `docker-compose.yml`: pgvector-capable PostgreSQL image for the local stack.
- `.env.example`, `docs/architecture/`, `docs/backend-status.md`, `docs/architecture/TODO.md`: config and operational instructions/status.

## Current implementation state

The PDF module and theory-session integration are implemented and covered by
unit tests. PDF.js is the open-source parser. The PostgreSQL model and RLS SQL
are authored, but have not been applied to the user's database and are not
represented as production-validated. Live NVIDIA/Cloudinary calls and the
restricted-role database isolation suite remain deployment prerequisites.
Chunk sizes count whitespace-separated pieces and are approximate, not exact
model-token counts.

## Implementation Tasks

### Task 1: Add page-aware PDF extraction and chunking

**Interfaces:** `PdfTextExtractor.extract(buffer: Uint8Array, maxPages: number): Promise<{ pages: Array<{ page: number; text: string }>; pageCount: number }>`; `chunkPdfPages(pages, { size: 512, overlap: 64 }): PdfChunkInput[]`.

- [x] Test page-number preservation, blank pages, max page rejection, malformed/encrypted PDFs, scanned PDFs with no text, and page-bounded overlapping chunks using small generated fixture PDFs.
- [x] Run targeted Vitest tests and confirm expected RED failures.
- [x] Add pinned `pdfjs-dist` dependency and implement bounded PDF.js extraction plus chunking.
- [x] Run targeted tests to GREEN; ensure parser does not log document content.

### Task 2: Add embedding adapter and safe Cloudinary file adapter

**Interfaces:** Cloudinary adapter uploads authenticated raw PDF streams, returns stable asset ID, downloads only by persisted ID through a short-lived signed URL, and deletes by ID. Embedding adapter accepts passage/query input mode and validates finite 1024-dimensional vectors.

- [x] Test missing config, upload/download/delete failures, no URL persistence, dimensions, non-finite values, empty input, and batching.
- [x] Run adapter tests to RED.
- [x] Add environment validation and adapters; use the NVIDIA OpenAI-compatible embedding endpoint with pinned model and explicit `passage`/`query` mode. Never use the chat API as an embedding fallback.
- [x] Run adapter tests to GREEN.

### Task 3: Add PDF metadata, upload/list/delete API, and quotas

**Interfaces:** authenticated `POST/GET /api/v1/pdfs`, `GET /api/v1/pdfs/:pdfId`, and `DELETE /api/v1/pdfs/:pdfId`; Mongo `PdfSource` ownership and status metadata; uploaded jobs carry only `{ idempotencyKey, sourceId, revision }`.

- [x] Test ownership, PDF signature/type/size/page/count validation, quotas, metadata status, enqueue recovery, bounded list pagination, and retrieval revocation on delete.
- [x] Run controller/service tests to RED.
- [x] Implement DTOs, persistence, Cloudinary orchestration, stable API errors, quotas, source leases/reconciliation, and cleanup jobs.
- [x] Run tests to GREEN.

### Task 4: Add pgvector schema, scoped RLS, local runtime support

**Interfaces:** `PdfChunk` rows keyed by owner/source/revision/chunk, 1024-dimensional `vector`, page citations, content hash, and embedding model version. Worker/API queries use restricted tenant/worker context.

- [ ] Add tests/assertions for schema/RLS SQL presence and extend the isolated harness for PDF cross-owner and worker-revision access.
- [x] Confirm RED in schema/RLS tests before SQL/schema changes.
- [x] Add the Prisma model and SQL migration with `CREATE EXTENSION vector`, table, indexes, grants, forced RLS policies, and narrowly scoped worker owner/session functions.
- [x] Switch local PostgreSQL image to a compatible pgvector image without changing host/container port 5432; add setup docs.
- [x] Generate clients and validate Prisma schemas.
- [ ] Run SQL against an isolated database and run two-user PDF runtime-role tests.

### Task 5: Add ingestion worker and crash recovery

**Interfaces:** `pdf-ingest-queue`, deterministic `pdf:<sourceId>:<revision>` identity; worker reloads source owner and Cloudinary asset from Mongo; persists chunks before atomically activating a revision; failure preserves prior active revision.

- [ ] Test successful extraction/embed/index, duplicate job, invalid file, parse/provider failure, retry behavior, old active revision retention, cleanup, and queued record reconciliation.
- [ ] Run worker tests to RED.
- [ ] Implement bounded concurrency worker, transactional tenant-scoped upserts, status transitions, dispatch leases/reconciler, and terminal sanitized error codes.
- [ ] Run worker tests and PostgreSQL integration tests to GREEN.

### Task 6: Add PDF retrieval, question generation, and theory-session lifecycle

**Interfaces:** theory sessions accept `mode: pdf` and bounded `pdfIds`; persist selected source revisions and async generation status; `pdf-question-generation-queue` payload contains session ID only; generated structured questions persist with verified citations.

- [ ] Test owned/ready source checks, retrieval owner/revision filters, threshold handling, citation ID/page validation, async status lifecycle, worker owner loading, retry/recovery, and zero-result `insufficient_material` state.
- [ ] Run theory/worker tests to RED.
- [ ] Implement tenant-scoped pgvector retrieval, Mastra structured output with untrusted source text constraints, durable question snapshot/status, citation validation, and existing question retrieval response integration.
- [ ] Run feature tests to GREEN.

### Task 7: Final verification, docs, and review

- [ ] Run focused PDF/theory tests, the full server gate, Prisma client generation/schema validation, PostgreSQL/RLS integration, and repository checks.
- [x] Update API docs, queue docs, storage and env docs, backend tracker, and setup steps to reflect actual behavior and provider prerequisites.
- [ ] Run the architecture viewer/docs check and inspect the final diff for unintended changes.
- [ ] Request a fresh code review, resolve findings, rerun verification, then commit the feature using a conventional message.

## Execution Notes

- Test the actual extraction code with committed small synthetic PDF fixtures; do not call external providers in unit tests.
- Live Cloudinary/NVIDIA validation is only possible if account credentials are configured. Never print or include secret values in logs or reports.
- Do not run a Prisma push or database migration against an existing user database. Use an isolated test database and document the operator migration command.
- If the selected NVIDIA embedding model is unavailable to the account, keep the feature disabled and report the provider prerequisite; do not silently substitute an incompatible model.
