# PDF Study API

All routes require a valid Clerk bearer token. The API derives ownership from
the authenticated Clerk subject; clients cannot supply an owner ID. Responses
use the standard `{ message, data }` envelope.

## Upload

`POST /api/v1/pdfs` requires an `Idempotency-Key` header and accepts one
`multipart/form-data` file field named `file`; it returns `202 Accepted`. Reuse
the same key only to retry the same file under the same filename. A matching
retry returns the original source without another quota reservation, Cloudinary
upload, or indexing job. Reusing the key with another file or filename returns
`409 Conflict`. After a failed upload, use a new key to start a separate
operation. The upload must have a `.pdf` filename,
`application/pdf` MIME type, and a valid `%PDF-` signature. Defaults are 10
MiB and 400 pages per file, ten active files / 50 MiB per account, and nine
uploads per UTC day. These defaults accommodate the nine PDFs in the
`binarybuddiesdev-wq/interview-prep` repository (about 19 MiB total; the largest
is 384 pages). Limits can be adjusted with `PDF_*` environment settings.

Selectable text is required. Scanned/image-only PDFs are not OCR-processed and
are rejected with an explanation. The API parses the PDF before storage, then
stores it as a private Cloudinary asset and queues background indexing. The
response contains the source ID and `queued` status; poll `GET /api/v1/pdfs/:id`
or list sources until status is `ready` or `failed`.

## Read and manage sources

| Method   | Path                          | Result                                                                                                                                               |
| -------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/pdfs?limit=20`       | Owned non-deleted sources; limit is 1–50.                                                                                                            |
| `GET`    | `/api/v1/pdfs/:pdfId`         | One owned source or 404.                                                                                                                             |
| `GET`    | `/api/v1/pdfs/:pdfId/content` | Inline `application/pdf` bytes for an owned ready source; private and no-store. Missing or unowned sources return 404; non-ready sources return 409. |
| `POST`   | `/api/v1/pdfs/:pdfId/reindex` | Requires `Idempotency-Key`; returns 202 and queues a new revision. A matching retry returns the same revision without another queue job.             |
| `DELETE` | `/api/v1/pdfs/:pdfId`         | Returns 202, immediately revokes retrieval access, then asynchronously deletes private storage and vector revisions.                                 |

Reindex keys use the shared 1–128 visible ASCII character policy. The newest
100 reindex operations are retained per source; a matching retry returns its
original revision even while that revision is processing. Once an operation
ages out of this bounded history, its key can start another reindex.

Deletion is naturally retry-safe without an idempotency header. While cleanup
is pending, a repeated delete dispatches the same deterministic worker job. If
cleanup has completed, the endpoint returns the owned source's `deleted`
status without scheduling another job; missing or unowned sources remain 404.

Source records expose `id`, `displayName`, `byteSize`, `pageCount`, `status`,
`activeRevision`, `failureCode`, and timestamps. They never expose Cloudinary
asset IDs, storage URLs, signed URLs, extracted text, or embeddings.

## PDF Study sessions

`POST /api/v1/theory/session` accepts `mode: "pdf"` with one to five unique
Mongo PDF source IDs in `pdfIds`. Each source must belong to the caller and
have an active indexed revision. The session records the selected revisions
and queues question generation asynchronously. `GET
/api/v1/theory/session/:sessionId/questions` returns the existing question
response once generation finishes; while it is queued/running, the API reports
that generation is still in progress. Generated questions include citations
to the source PDF and page used by the model.
Recognized personal-information patterns in retrieved excerpt text are masked
in the provider prompt; stored source chunks and citations are not modified.

If generation fails, the questions endpoint returns `503`. Daily AI token
budget exhaustion returns a retry-tomorrow message. If the safety detector
blocks unsafe instructions in retrieved excerpts, the response says the PDF
content could not safely be used to generate questions. Other generation
failures use the generic unavailable message.

## Configuration and local database setup

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
and `NVIDIA_API_KEY`. `NVIDIA_EMBEDDING_BASE_URL` is optional; by default the
service uses the NVIDIA OpenAI-compatible endpoint and the pinned
`nvidia/nemotron-3.5-embed-1b` model with its 1024-dimensional output option.
No chat-model fallback is
used for embeddings. Cloudinary must permit authenticated PDF delivery.

The local compose PostgreSQL service uses `pgvector/pgvector:pg16`. Before
first use of the PDF feature, use a database administrator connection to run
`CREATE EXTENSION IF NOT EXISTS vector;`, then run
`pnpm --filter server prisma:push:postgresql`. Apply
`server/prisma/rls/001-tenant-rls.sql` with its required role-password psql
variables, followed by `server/prisma/rls/002-pdf-rag.sql`. Review the
[RLS rollout guide](../backend/postgresql-rls-rollout.md) before applying to a
deployed database. Production runtime connections must use restricted,
non-bypass roles. Unit tests do not replace the restricted-role PostgreSQL
isolation test.

The parser uses Mozilla PDF.js (`pdfjs-dist`, Apache-2.0). It extracts page
text without OCR; image-only documents need OCR support added separately.
