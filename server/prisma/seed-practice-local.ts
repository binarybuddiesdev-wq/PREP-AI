import { PrismaClient } from '@prisma/client';

import { upsertQuestions } from '../../scripts/seed/questions.data.js';
import { upsertTopics } from '../../scripts/seed/topics.data.js';

const args = new Set(process.argv.slice(2));
const localDatabaseUrl =
  'mongodb://prepai:prepai@127.0.0.1:27017/prepai?authSource=admin&replicaSet=rs0&directConnection=true';

if (!args.has('--local')) {
  throw new Error('Pass --local to seed the local Podman MongoDB database.');
}

process.env['DATABASE_URL'] = localDatabaseUrl;

const main = async (): Promise<void> => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    if (!args.has('--questions-only')) {
      await upsertTopics(prisma);
    }
    if (!args.has('--topics-only')) {
      const inserted = await upsertQuestions(prisma);
      console.info(`Seeded ${inserted} new practice question(s) in local MongoDB.`);
    }
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error('Practice seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
