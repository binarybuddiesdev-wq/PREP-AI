# AI input PII redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Apply the existing local personal-information redactor to natural-language AI inputs before both prompt-injection detection and answer generation.

**Architecture:** Reuse `redactPersonalInformation` in Study Chat, Tech Expert JSON/SSE, and PDF question generation. Create sanitized provider-only copies; leave persisted and source text intact. Do not alter submitted code.

**Tech Stack:** TypeScript, NestJS, Mastra, Vitest.

**Spec:** [AI input PII redaction design](../specs/2026-11-04-ai-input-pii-redaction-design.md)

## Global Constraints

- Preserve originals in user transcripts, PDF chunks, and API request objects.
- Redact recognized emails, phones, Luhn-valid cards, Aadhaar, PAN, and US SSNs before detector/model calls.
- Do not redact code review source.
- Do not claim complete anonymization; names, free-form addresses, and unknown identifiers may remain.

## Review Focus

- The detector receives the same sanitized text as the answer model.
- Study Chat's nested content parts are copied without mutating the caller's messages.
- Tech Expert one-shot and SSE flows both redact before their detectors.
- PDF citation IDs/pages remain unchanged while excerpt text is sanitized.
- Coding review continues to receive original source code.

## Tasks

- [x] Add failing tests for provider-bound Study Chat, Tech Expert, and PDF input copies.
- [x] Apply the shared redactor in those three input surfaces before detector creation/generation.
- [x] Update AI privacy/architecture/backend docs to state exact protection scope and limitations.
- [x] Run focused suites and the full server gate.
- [x] Review, commit, and push to `main`.
