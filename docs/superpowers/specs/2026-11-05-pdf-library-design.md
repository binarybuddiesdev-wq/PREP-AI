# PDF Documents, Library, and Study Design

## Intent

Port the document upload, library, and PDF Study flows from `prepai-ui.html` into the existing React app. Learners should be able to upload real PDFs, see indexing state, manage their documents, read privately stored files, and practice from one to five indexed sources with source/page citations.

## Goals

- Add typed PDF source contracts and API functions for upload, list, detail, reindex, delete, and private content retrieval.
- Keep request state and cached PDF source data in TanStack Query under user-scoped keys; keep file selection, drag state, and viewer controls local to their pages.
- Provide PDF upload through Settings > Documents with file picker and drag/drop, client checks, upload progress, idempotent retries, and queued/processing/ready/failed feedback.
- Show real byte size, page count, status, and server failure reason; allow reindex and confirmed deletion where supported.
- Add the Library route with a grid/list, a reader, page navigation, zoom, and fullscreen behavior.
- Add PDF Study source selection, question generation, answer evaluation, and source/page citations through the existing theory session lifecycle.
- Preserve responsive layouts, keyboard interaction, reduced motion, loading/error/empty states, and the current seven-layer import rules.

## Non-goals

- OCR for scanned/image-only PDFs; the API rejects documents without selectable text.
- A persistent per-document enabled/disabled setting; the backend has no such preference contract. Source selection belongs to each PDF Study session.
- Cloudinary URLs, asset IDs, extracted text, or embeddings in the browser.
- New billing, quota counters, local fake documents, sample questions, or simulated success.
- A third-party PDF viewer dependency. The Library uses the browser PDF viewer over an owner-authenticated response and a temporary in-memory object URL.

## Backend and product constraints

- Upload is one multipart `file` request per file to `POST /api/v1/pdfs`, with `Idempotency-Key`; the server accepts only real PDFs with selectable text, up to 10 MiB and 100 pages by default.
- Upload response is queued. The server source API exposes ID, display name, byte size, page count, status, active revision, failure code, and timestamps. Poll while queued/processing; stop at ready/failed/deleting.
- Reusing an upload key is valid only for the exact same filename and bytes. A distinct file requires a new key. Reindex is idempotent with a key; delete is naturally retry-safe.
- PDF Study uses `POST /api/v1/theory/session` with `mode: "pdf"` and one to five unique ready source IDs. The server owns validation and quota decisions.
- The current backend has no PDF-content route. Add an authenticated, owner-checked proxy that returns bytes only for a ready owned source, uses the existing private storage download method and maximum file-size bound, and sets private/no-store and inline PDF headers. Never return a signed Cloudinary URL.
- The API reports generation-in-progress while PDF questions are being prepared. The UI must present a pending state and poll only that condition; it must not turn it into a terminal error or fabricate questions.
- Generated PDF questions include source/page citations. Extend the typed question contract to match the actual API response before rendering citations.

## Approaches considered

1. **Use Cloudinary signed URLs in the browser.** This would simplify the viewer, but signed URLs leave the API boundary, can be copied, and contradict the API contract that hides storage URLs.
2. **Owner-authenticated API proxy with a temporary browser object URL (selected).** The server validates ownership and readiness before fetching the private object; the UI keeps the bytes in memory only while the reader is open. This adds a small binary endpoint but preserves the existing privacy boundary and allows browser-native PDF rendering without a new UI dependency.
3. **Use static/local sample PDFs or base64 fixtures.** This resembles the prototype but cannot show the learner's documents or preserve access control, so it is not suitable for the product flow.

## UI structure

- Settings > Documents reuses a feature-level document manager for upload, status, reindex, and delete.
- `/library` is an authenticated route and active sidebar destination. Its viewer fetches the selected file through the API client, creates a short-lived object URL, and revokes it when selection changes or the page unmounts.
- PDF Study is a third enabled practice mode only when at least one ready source exists. The user selects one to five sources for that session; no persistent enable switch is displayed.
- API and query logic live in `service/api` and `logic/pdf`; contracts and route identifiers live in `core`; reusable UI lives in `components`; route composition and API-state mapping live in `pages`.

## Failure and recovery behavior

- Invalid type, MIME, signature, size, encrypted/unreadable file, no selectable text, page limit, file count/storage quota, and daily upload quota are shown as actionable per-file errors.
- Upload retries reuse the same idempotency key only for the same file identity; changing a file creates a new operation.
- Indexing can be retried with reindex only for ready/failed sources; delete always asks for confirmation and reflects the server's deleting state.
- Source list/read/upload/reindex/delete and private-content failures have visible retry or recovery actions. An unavailable PDF source never silently becomes a local sample.
- The browser viewer reports unsupported preview or content errors and offers a return-to-Library action.
- PDF question-generation and answer-evaluation failures remain distinct, retryable states using the existing practice session behavior.

## Acceptance evidence

- TDD tests cover API mapping, authentication gates, upload validation/idempotency/progress, list polling stop conditions, reindex/delete errors, private-content ownership/status, viewer URL cleanup and controls, PDF source selection limits/readiness, generation polling, citations, and mobile/desktop layout states.
- Browser checks exercise upload drag/drop and picker, indexing success/failure, reindex/delete confirmation, Library selection/preview/page/zoom/fullscreen, and a complete PDF Study session at desktop and mobile widths.
- Full UI lint/type/build/tests pass. Server lint/type/build/tests and PDF-specific tests pass for the required secure-content endpoint. Root-only failures are reported without modifying unrelated work.
