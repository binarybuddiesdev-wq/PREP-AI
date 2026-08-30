import type { PrismaClient } from '@prisma/client';
import type { ISeedTopic } from './seed.types.js';

export const seedTopics: ISeedTopic[] = [
  { name: 'React', slug: 'react', category: 'practice', icon: '⚛️' },
  { name: 'TypeScript', slug: 'typescript', category: 'practice', icon: '🔷' },
  { name: 'JavaScript', slug: 'javascript', category: 'practice', icon: '🟨' },
  { name: 'HTML', slug: 'html', category: 'practice', icon: '📄' },
  { name: 'CSS', slug: 'css', category: 'practice', icon: '🎨' },
  { name: 'Node.js', slug: 'nodejs', category: 'practice', icon: '🟢' },
  { name: 'ExpressJS', slug: 'expressjs', category: 'practice', icon: '🚂' },
  { name: 'NestJS', slug: 'nestjs', category: 'practice', icon: '🐱' },
  { name: 'MongoDB', slug: 'mongodb', category: 'practice', icon: '🍃' },
  { name: 'PostgreSQL', slug: 'postgresql', category: 'practice', icon: '🐘' },
  { name: 'Redis', slug: 'redis', category: 'practice', icon: '🟥' },
  { name: 'System Design', slug: 'system-design', category: 'practice', icon: '🏗️' },
  { name: 'Arrays', slug: 'arrays', category: 'coding', icon: '📊' },
  { name: 'Stacks', slug: 'stacks', category: 'coding', icon: '🥞' },
  { name: 'Hash Maps', slug: 'hash-maps', category: 'coding', icon: '#️⃣' },
  { name: 'Binary Search', slug: 'binary-search', category: 'coding', icon: '🔍' },
  { name: 'Linked Lists', slug: 'linked-lists', category: 'coding', icon: '🔗' },
  { name: 'Trees', slug: 'trees', category: 'coding', icon: '🌳' },
  { name: 'Graphs', slug: 'graphs', category: 'coding', icon: '🕸️' },
  { name: 'Dynamic Programming', slug: 'dynamic-programming', category: 'coding', icon: '📈' },
  { name: 'Two Pointers', slug: 'two-pointers', category: 'coding', icon: '👉' },
  { name: 'Backtracking', slug: 'backtracking', category: 'coding', icon: '↩️' },
  { name: 'Sliding Window', slug: 'sliding-window', category: 'coding', icon: '🪟' },
];

export const seedTopicsBySlug = (slug: string): ISeedTopic | undefined =>
  seedTopics.find((topic) => topic.slug === slug);

export const upsertTopics = async (prisma: PrismaClient): Promise<void> => {
  for (const topic of seedTopics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name, category: topic.category, icon: topic.icon },
      create: topic,
    });
  }
};
