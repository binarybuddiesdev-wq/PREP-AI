# Prisma setup, scripts and the two services

Reference for the `prisma-database` skill. The two schemas and generators, the scripts, generated-client locations, and how `PrismaPostgresqlService` no-ops. Load when running Prisma commands or debugging "Database not available".

## The Prisma setup

### Two schemas, two generators, two clients

```
server/prisma/
├── schema.prisma              # MongoDB schema (default)
└── schema.postgresql.prisma  # PostgreSQL schema
```

The Mongo schema's generator writes to Prisma's default location
(`node_modules/.prisma/client`). The Postgres schema's generator
explicitly outputs to `server/src/generated/postgresql-client/`:

```prisma
// schema.postgresql.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/postgresql-client"
}
```

This is why the Postgres client is imported as
`from '../generated/postgresql-client/index.js'` in `prisma.service.ts`.

### Available scripts (from `server/package.json`)

| Script                           | What it does                           | When to run                     |
| -------------------------------- | -------------------------------------- | ------------------------------- |
| `pnpm prisma:generate`           | Generates both Prisma clients          | After any schema change         |
| `pnpm prisma:push:mongodb`       | Pushes the Mongo schema to the live DB | After schema change (dev only)  |
| `pnpm prisma:push:postgresql`    | Pushes the Postgres schema             | After schema change (dev only)  |
| `pnpm prisma:migrate:postgresql` | Creates a real migration file          | When you want migration history |

**`db push` vs `migrate dev`:** use `db push` for fast iteration in
dev. Use `migrate dev` when you want a real migration file in
`server/prisma/migrations/`. For a portfolio project with no real
deployments yet, `db push` is fine.

### Generated client locations (matter for imports)

- **Mongo** client: `node_modules/.prisma/client` (Prisma default)
- **Postgres** client: `server/src/generated/postgresql-client/`
  (gitignored via the `generated/` entry in the root `.gitignore`, then regenerated)

The Postgres client is **gitignored** (typical Prisma convention). Every
new dev / CI / production deploy must run `pnpm prisma:generate` after
cloning. If you see "Database not available" at boot, this is the cause.

## The two services — and the graceful no-op

```ts
// server/src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('MongoDB connected');
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
    }
  }
}

@Injectable()
export class PrismaPostgresqlService implements OnModuleInit, OnModuleDestroy {
  private client: PostgresPrismaClient | undefined;

  async onModuleInit() {
    if (!process.env['POSTGRESQL_URL']) {
      this.logger.warn('POSTGRESQL_URL not set — PostgreSQL skipped');
      return; // ← graceful no-op
    }
    try {
      this.client = new PostgresPrismaClient();
      await this.client.$connect();
    } catch (error) {
      this.logger.error('PostgreSQL connection failed', error);
    }
  }

  get client_(): PostgresPrismaClient | undefined {
    return this.client;
  }
}
```

**Critical consequence for your code:** the Postgres client may be
`undefined` (if `POSTGRESQL_URL` is unset or the client wasn't generated).
Every call site must use optional chaining:

```ts
const session = await this.postgres.client_?.theorySession.findUnique({
  where: { id: sessionId },
});
if (!session) {
  throw new NotFoundException(THEORY_SESSION_NOT_FOUND);
}
```

The `?.` after `client_` is **load-bearing**. Don't remove it. Don't
"simplify" it to assume the client is always present.
