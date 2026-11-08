import type { PrismaClient } from '@prisma/client';
import type { ISeedTopic } from './seed.types.js';
import {
  questionBankTopics,
  questionBankTopicsBySlug,
} from '../../server/src/modules/question-bank/question-bank-catalog.js';

export const seedTopics: ISeedTopic[] = [...questionBankTopics];

export const seedTopicsBySlug = (slug: string): ISeedTopic | undefined =>
  questionBankTopicsBySlug(slug);

export const upsertTopics = async (prisma: PrismaClient): Promise<void> => {
  for (const topic of seedTopics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name, category: topic.category, icon: topic.icon },
      create: topic,
    });
  }
};
