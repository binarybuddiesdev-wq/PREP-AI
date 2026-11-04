# Coding Problem Catalog Implementation Plan

> **For agentic workers:** Implement each task test-first, following the project
> layer boundaries. Commit and push each completed task to `main` as requested.

**Goal:** Ship an authenticated coding problem catalogue and deep-linkable
problem detail view using real backend data.

**Spec:** `docs/superpowers/specs/2026-11-05-coding-problem-catalog-design.md`

## Task 1: Solved state in the coding API

- [x] Add failing controller/service tests for user-scoped accepted problem IDs.
- [x] Return `isSolved` on each problem summary based on accepted answers for
      the authenticated user.
- [x] Add the response schema field and verify coding server tests/build.

## Task 2: Typed UI API and query readers

- [x] Add core problem summary/detail/example types and list/detail service API
      functions with API tests.
- [x] Add user-scoped coding query keys/readers and tests for auth gating,
      params, detail ids/slugs, and failures.

## Task 3: Catalog and detail UI

- [ ] Add failing tests for filters, combined filtering, solved state, empty and
      retry states, detail examples/constraints, and deep-link navigation.
- [ ] Add presentational catalog/detail components and route-level composition.
- [ ] Add `/coding` and `/coding/:problemId`, sidebar navigation, active title,
      and route exports.

## Task 4: Verification and delivery

- [ ] Run UI and server checks, lint, typecheck, builds, formatting, and agent
      docs validation.
- [ ] Update `docs/project-tracker.md` and review the final diff.
- [ ] Commit and push to `main`.
