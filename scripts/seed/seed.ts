#!/usr/bin/env -S node --import tsx
/**
 * Seed PrepAI's MongoDB with the canonical topic + question bank.
 *
 * Reads the .env file at the repo root, instantiates PrismaService, then
 * upserts topics and inserts questions that are not already present.
 * Idempotent — safe to re-run.
 *
 * Usage (from repo root):
 *   pnpm seed                # topics + questions
 *   pnpm seed --topics-only  # topics only
 *
 * Env required:
 *   DATABASE_URL — Mongo connection string (see .env.example)
 */

import { config as loadEnv } from 'node:process';
import { PrismaClient } from '@prisma/client';
import { upsertTopics } from './topics.data.js';
import { upsertQuestions } from './questions.data.js';

const args = process.argv.slice(2);
const topicsOnly = args.includes('--topics-only');
const questionsOnly = args.includes('--questions-only');

const main = async (): Promise<void> => {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL is required. Run `cp .env.example .env` and fill it in.');
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    if (!questionsOnly) {
      await upsertTopics(prisma);
    }
    if (!topicsOnly) {
      const inserted = await upsertQuestions(prisma);
      console.info(`seeded ${inserted} new question(s)`);
    }
  } finally {
    await prisma.$disconnect();
  }
};

void loadEnv;

main().catch((error) => {
  console.error('seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
