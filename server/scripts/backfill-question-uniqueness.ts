import { PrismaClient } from '@prisma/client';
import { backfillQuestionUniqueness } from '../src/modules/question/question-uniqueness-backfill.js';

const prisma = new PrismaClient();

try {
  const result = await backfillQuestionUniqueness(prisma);
  console.info(
    `Question uniqueness backfill complete: scanned=${result.scanned}, created=${result.created}, removed=${result.removed}`
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Question uniqueness backfill failed unexpectedly'
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
