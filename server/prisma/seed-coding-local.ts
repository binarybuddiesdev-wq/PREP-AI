import { PrismaClient } from '../src/generated/postgresql-client/index.js';

const databaseUrl = process.env['POSTGRESQL_URL'];
if (!databaseUrl) throw new Error('POSTGRESQL_URL is required');

const target = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname)) {
  throw new Error(
    `Refusing coding seed: PostgreSQL host must be localhost (received ${target.hostname})`
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  await prisma.codingQuestion.upsert({
    where: { slug: 'two-sum' },
    update: {
      title: 'Two Sum',
      description:
        'Given an array of integers and a target, return the indices of two values that add up to the target.',
      difficulty: 'Easy',
      topic: 'Arrays',
      examples: [
        { input: [[2, 7, 11, 15], 9], output: [0, 1], explanation: '2 + 7 = 9.' },
        { input: [[3, 2, 4], 6], output: [1, 2], explanation: '2 + 4 = 6.' },
      ],
      constraints: ['Exactly one solution exists.', 'You may not use the same element twice.'],
      codeJs: 'function solution(nums, target) {\n  // Write your solution here\n}',
      codeTs:
        'function solution(nums: number[], target: number): number[] {\n  // Write your solution here\n  return [];\n}',
      codePy: 'def solution(nums, target):\n    # Write your solution here\n    return []',
    },
    create: {
      slug: 'two-sum',
      title: 'Two Sum',
      description:
        'Given an array of integers and a target, return the indices of two values that add up to the target.',
      difficulty: 'Easy',
      topic: 'Arrays',
      examples: [
        { input: [[2, 7, 11, 15], 9], output: [0, 1], explanation: '2 + 7 = 9.' },
        { input: [[3, 2, 4], 6], output: [1, 2], explanation: '2 + 4 = 6.' },
      ],
      constraints: ['Exactly one solution exists.', 'You may not use the same element twice.'],
      codeJs: 'function solution(nums, target) {\n  // Write your solution here\n}',
      codeTs:
        'function solution(nums: number[], target: number): number[] {\n  // Write your solution here\n  return [];\n}',
      codePy: 'def solution(nums, target):\n    # Write your solution here\n    return []',
    },
  });
  console.info('Seeded the Two Sum coding problem into local PostgreSQL.');
} finally {
  await prisma.$disconnect();
}
