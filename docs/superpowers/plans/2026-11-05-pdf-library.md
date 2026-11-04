# PDF Documents, Library, and Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real PDF upload, private Library preview, and PDF Study using the existing UI and API architecture.

**Architecture:** API operations and contracts live in `ui/src/service` and `ui/src/core`; TanStack Query state and polling live in `ui/src/logic/pdf`; UI primitives live in `ui/src/components`; pages compose them. Add one authenticated server content endpoint that checks owner and ready status before streaming privately stored bytes.

**Tech Stack:** React, TypeScript, TanStack Query, Ky, Fastify, Prisma, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-pdf-library-design.md`

## Global Constraints

- Never expose storage URLs, Cloudinary asset IDs, extracted text, or embeddings to the browser.
- Upload one `application/pdf` file per request with an idempotency key; defaults are 10 MiB, 100 pages, five active files / 50 MiB per account, and three uploads per UTC day.
- PDF Study selects one to five unique ready source IDs and uses the existing theory session API.
- Scanned/image-only PDFs are rejected; do not add OCR or fake/sample documents.
- Use existing dependencies and the existing seven-layer UI architecture.

## Review Focus

- Non-owned, failed, deleting, or missing sources cannot be previewed; add controller/service coverage for all access branches.
- Upload retries preserve identity and idempotency; changed files receive a new key.
- Polling stops at terminal statuses and does not multiply requests while the page is hidden.
- Browser object URLs are revoked on document changes and unmount.
- Slow PDF question generation remains a pending state; only ready source citations are rendered.

## File Map

- `server/src/modules/pdf/pdf.controller.ts`, `pdf.service.ts`, and tests: authenticated private content route and ownership/readiness checks.
- `ui/src/core/pdf/*`, `ui/src/service/api/pdf*`, and `ui/src/logic/pdf/*`: contracts, API functions, keys, queries, polling, and mutations.
- `ui/src/components/pdf/*`: shared upload, document list, source selector, and reader controls.
- `ui/src/pages/*`, `ui/src/app/*`: Settings Documents and Library route composition.
- `ui/src/components/practice/*`, `ui/src/logic/theory/*`: PDF source selection, generation pending behavior, and citations.
- `docs/project-tracker.md`: mark Phase 4 complete only after all acceptance checks pass.

## Tasks

### Task 1: Secure PDF content endpoint

**Interfaces:** `GET /api/v1/pdfs/:pdfId/content` returns private PDF bytes only for an owned, ready source. It uses the existing bounded private storage download and `Cache-Control: private, no-store`; it never returns a redirect or storage URL.

- [x] Add failing controller/service tests for owner, non-owner, missing, not-ready, and successful bounded content retrieval.
- [x] Implement the route through the existing PDF service and private storage method.
- [x] Run focused server tests, lint, and typecheck; commit.

### Task 2: PDF contracts and data layer

**Interfaces:** typed source/list/upload/content contracts; API methods for list, detail, upload progress, content bytes, reindex, and delete; user-scoped TanStack Query keys; terminal-aware list/detail polling.

- [x] Add failing API and query tests for envelope mapping, upload progress, headers, retry identity, and poll stop states.
- [x] Implement service and logic layers following current API patterns.
- [x] Run focused UI tests, lint, and TypeScript; commit.

### Task 3: Settings > Documents manager

**Interfaces:** `PdfDocumentManager` consumes the list query and upload/reindex/delete mutations; file validation is aligned with the server contract and never claims server validation has completed.

- [x] Add failing component tests for picker/drop, validation, progress, statuses, reindex, delete confirmation, and recovery.
- [x] Implement responsive document manager and route/settings navigation.
- [x] Run focused tests and UI checks; commit.

### Task 4: Library preview

**Interfaces:** `/library` lists owned sources and fetches only selected ready PDF bytes. A page-level effect creates and revokes one object URL; native browser PDF controls handle page, zoom, and fullscreen.

- [x] Add failing tests for empty/loading/error states, selection, object URL cleanup, and unavailable preview.
- [x] Implement Library route and preview controls without a new viewer dependency.
- [x] Run focused tests and UI checks; commit.

### Task 5: PDF Study integration

**Interfaces:** practice setup selects one to five ready IDs; start sends `mode: "pdf"` and `pdfIds`; questions query distinguishes generation pending from terminal failure and renders actual API citations.

- [x] Add failing tests for selection bounds/readiness, payload, generation polling, citations, and evaluation flow.
- [x] Implement PDF mode through the existing theory session lifecycle.
- [x] Run focused tests and UI checks; commit.

### Task 6: Full verification and tracker

- [x] Run complete UI and server test suites, UI lint, typecheck, and build.
- [ ] Capture live desktop/mobile browser views with an authenticated browser session; this session has no browser surface for signed-in QA.
- [x] Update the project tracker with completed scope and remaining limitations.
- [x] Review the final diff, commit, and push to `main`.
