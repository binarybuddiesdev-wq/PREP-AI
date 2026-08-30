import type { PrismaClient } from '@prisma/client';
import { seedTopicsBySlug } from './topics.data.js';
import type { ISeedQuestion } from './seed.types.js';

export const seedQuestions: ISeedQuestion[] = [
  {
    topicSlug: 'react',
    difficulty: 'Junior',
    question: 'What is the difference between state and props in React?',
    referenceAnswer:
      'Props are read-only inputs passed from a parent component; state is a local, mutable value owned by the component. Updating state triggers a re-render; changing props from a child is not allowed.',
  },
  {
    topicSlug: 'react',
    difficulty: 'Mid',
    question: 'Explain the useEffect cleanup function. When does it run?',
    referenceAnswer:
      'The cleanup function runs before the effect re-runs and when the component unmounts. Use it to unsubscribe from listeners, cancel timers, or close connections so the next effect starts from a clean slate.',
  },
  {
    topicSlug: 'typescript',
    difficulty: 'Junior',
    question: 'What is the difference between `interface` and `type` in TypeScript?',
    referenceAnswer:
      'Both describe object shapes. `interface` is open to declaration merging and is recommended for object types. `type` supports unions, intersections, and primitive aliases. Choose `interface` for public object contracts and `type` for unions/utility types.',
  },
  {
    topicSlug: 'typescript',
    difficulty: 'Mid',
    question: 'What does `unknown` buy you over `any`?',
    referenceAnswer:
      '`unknown` forces the caller to narrow the value (e.g. via `typeof` or a type guard) before using it. `any` skips type checking entirely, propagating the unsoundness through the codebase.',
  },
  {
    topicSlug: 'javascript',
    difficulty: 'Junior',
    question: 'Explain event delegation and why it is useful.',
    referenceAnswer:
      'Attach a single listener to a parent and use `event.target` (or a closest-match helper) to react to children. It works because DOM events bubble. It costs less memory and handles dynamically-added children for free.',
  },
  {
    topicSlug: 'javascript',
    difficulty: 'Mid',
    question: 'What is the difference between `==` and `===`?',
    referenceAnswer:
      '`===` checks value AND type without coercion. `==` applies type coercion first (e.g. `"1" == 1` is `true`). Default to `===` unless you have a specific reason to lean on coercion.',
  },
  {
    topicSlug: 'nodejs',
    difficulty: 'Junior',
    question: 'What is the event loop in Node.js?',
    referenceAnswer:
      'A loop that processes phases — timers, pending callbacks, poll, check, close — draining each phase\'s queue before moving on. Microtasks (Promise callbacks, `process.nextTick`) run between phases, which is why they feel "immediate".',
  },
  {
    topicSlug: 'nodejs',
    difficulty: 'Mid',
    question: 'How do you handle unhandled promise rejections in production?',
    referenceAnswer:
      'Listen on `process.on("unhandledRejection")` and `process.on("uncaughtException")`, log the error with full context, and either exit the process (preferred — let your orchestrator restart you) or flush queued work and shut down gracefully.',
  },
  {
    topicSlug: 'expressjs',
    difficulty: 'Junior',
    question: 'What is middleware in Express?',
    referenceAnswer:
      'A function with `(req, res, next)` that runs in order for every request. It can mutate `req`/`res`, end the response, or call `next()` to pass control to the next middleware. Error-handling middleware has a fourth `(err, req, res, next)` parameter.',
  },
  {
    topicSlug: 'nestjs',
    difficulty: 'Junior',
    question: 'What is the role of a Module in NestJS?',
    referenceAnswer:
      "A Module groups related providers, controllers, and exports. Use `@Global()` to make a module's providers available everywhere without re-importing. The root `AppModule` is the composition root that wires every feature module together.",
  },
  {
    topicSlug: 'mongodb',
    difficulty: 'Junior',
    question: 'What is the difference between a document and a collection in MongoDB?',
    referenceAnswer:
      'A document is a JSON-like record (BSON). A collection is a group of documents, like a table in SQL but schema-less. Collections live inside a database, and there is no enforced cross-document schema.',
  },
  {
    topicSlug: 'system-design',
    difficulty: 'Mid',
    question: 'When would you choose a SQL database over a document store?',
    referenceAnswer:
      'Pick SQL when you need strict schema, multi-row transactions, joins, and powerful indexing for relational queries. Pick a document store when records are naturally hierarchical, schema evolves per record, and you scale by sharding whole documents.',
  },
];

export const upsertQuestions = async (prisma: PrismaClient): Promise<number> => {
  let inserted = 0;
  for (const item of seedQuestions) {
    const topic = seedTopicsBySlug(item.topicSlug);
    if (!topic) continue;
    const topicRow = await prisma.topic.findUnique({ where: { slug: topic.slug } });
    if (!topicRow) continue;
    const existing = await prisma.question.findFirst({
      where: { topicId: topicRow.id, question: item.question },
    });
    if (existing) continue;
    await prisma.question.create({
      data: {
        topicId: topicRow.id,
        question: item.question,
        difficulty: item.difficulty,
        referenceAnswer: item.referenceAnswer,
      },
    });
    inserted++;
  }
  return inserted;
};
