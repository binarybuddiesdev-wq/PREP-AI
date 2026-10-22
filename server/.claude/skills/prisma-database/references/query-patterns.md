# Query patterns and performance

Reference for the `prisma-database` skill. Read, list, create, delete and update patterns, plus N+1, indexes and `select`. Load when writing a service method.

## The query patterns

### Read by ID (after auth check)

```ts
async getTopicBySlug(slug: string) {
  const topic = await this.prisma.topic.findUnique({ where: { slug } });
  if (!topic) throw new NotFoundException(TOPIC_NOT_FOUND);
  return topic;
}
```

Two lines: query, throw if missing. Don't add extra reads in the same
method (N+1 territory).

### List with optional filter

```ts
async getAllCategories(dto: GetTopicsDto) {
  const { category } = dto;
  const where = category ? { category } : {};
  const topics = await this.prisma.topic.findMany({ where });
  return topics;
}
```

Build the `where` object conditionally. Don't use string concatenation
or raw SQL.

### Create with conflict check

```ts
async createTopic(dto: CreateTopicDto) {
  const existing = await this.prisma.topic.findFirst({
    where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
  });
  if (existing) throw new ConflictException(TOPIC_ALREADY_EXISTS);

  return this.prisma.topic.create({ data: dto });
}
```

Always do the conflict check **before** the create. A unique-index
violation at insert time produces an error that's not as clean as a
pre-checked `ConflictException`.

### Delete with cascade check

```ts
async deleteTopic(id: string) {
  const questionCount = await this.prisma.question.count({ where: { topicId: id } });
  if (questionCount > 0) {
    throw new BadRequestException(CANNOT_DELETE_TOPIC_WITH_QUESTIONS);
  }
  return this.prisma.topic.delete({ where: { id } });
}
```

Check for dependent rows before deleting. The error message tells the
user what to do ("delete or reassign questions first"). Cascading
deletes via Prisma `@relation(onDelete: Cascade)` work for
within-database relationships (see `TheoryAnswer.session`) but **not
for cross-database deletes** (Mongo → Postgres).

### Update with sparse fields

```ts
const topic = await this.prisma.topic.update({
  where: { id },
  data: {
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.slug !== undefined && { slug: dto.slug }),
    ...(dto.category !== undefined && { category: dto.category }),
  },
});
```

The conditional spread pattern lets a PATCH endpoint accept partial
updates without overwriting fields with `undefined`.

## Performance — what to watch for

### N+1 queries

The single most common Prisma antipattern. If you see a service doing
a list query and then a per-item query inside a loop, that's N+1.

```ts
// WRONG — N+1: 1 query for sessions, N for each session's answers
const sessions = await this.prisma.theorySession.findMany();
for (const s of sessions) {
  s.answers = await this.prisma.theoryAnswer.findMany({ where: { sessionId: s.id } });
}

// CORRECT — single query with `include`
const sessions = await this.prisma.theorySession.findMany({
  include: { answers: true },
});
```

### Missing indexes

If a query is slow, the first thing to check is the `EXPLAIN` plan. If
it's a collection/table scan (`COLLSCAN` in Mongo, `Seq Scan` in
Postgres), you need an index. The fix is in the schema, not the query.

### `select` over `find*`

When you only need a few fields, use `select` to avoid loading the
whole row:

```ts
const counts = await this.prisma.theorySession.groupBy({
  by: ['userId'],
  where: { userId },
  _count: { _all: true },
});
```

For the Postgres `TheorySession` list endpoint, consider selecting only
the columns you actually return, not `*`.
