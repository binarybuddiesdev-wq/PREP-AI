import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  mongoConnect: vi.fn(),
  mongoDisconnect: vi.fn(),
  postgresConnect: vi.fn(),
  postgresDisconnect: vi.fn(),
  postgresConstructor: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClientMock {
    $connect() {
      return prismaMocks.mongoConnect();
    }

    $disconnect() {
      return prismaMocks.mongoDisconnect();
    }
  },
}));

vi.mock('../generated/postgresql-client/index.js', () => ({
  PrismaClient: class PostgresPrismaClientMock {
    constructor() {
      prismaMocks.postgresConstructor();
    }

    $connect() {
      return prismaMocks.postgresConnect();
    }

    $disconnect() {
      return prismaMocks.postgresDisconnect();
    }
  },
}));

import { PrismaPostgresqlService, PrismaService } from './prisma.service.js';

describe('Prisma services', () => {
  let log: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.mongoConnect.mockResolvedValue(undefined);
    prismaMocks.mongoDisconnect.mockResolvedValue(undefined);
    prismaMocks.postgresConnect.mockResolvedValue(undefined);
    prismaMocks.postgresDisconnect.mockResolvedValue(undefined);
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('connects and disconnects the MongoDB Prisma client', async () => {
    const service = new PrismaService();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(prismaMocks.mongoConnect).toHaveBeenCalledOnce();
    expect(prismaMocks.mongoDisconnect).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('MongoDB connected');
  });

  it('logs a MongoDB connection failure and still allows shutdown', async () => {
    const connectionError = new Error('Mongo unavailable');
    prismaMocks.mongoConnect.mockRejectedValueOnce(connectionError);
    const service = new PrismaService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('MongoDB connection failed', connectionError);
    expect(prismaMocks.mongoDisconnect).toHaveBeenCalledOnce();
  });

  it('skips PostgreSQL when its connection string is absent', async () => {
    vi.stubEnv('POSTGRESQL_URL', '');
    const service = new PrismaPostgresqlService();

    await service.onModuleInit();

    expect(service.client_).toBeUndefined();
    expect(prismaMocks.postgresConstructor).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('POSTGRESQL_URL not set — PostgreSQL skipped');
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('connects and disconnects PostgreSQL when configured', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const service = new PrismaPostgresqlService();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(prismaMocks.postgresConstructor).toHaveBeenCalledOnce();
    expect(prismaMocks.postgresConnect).toHaveBeenCalledOnce();
    expect(prismaMocks.postgresDisconnect).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('PostgreSQL connected');
  });

  it('logs PostgreSQL connection failures without failing module initialization', async () => {
    vi.stubEnv('POSTGRESQL_URL', 'postgresql://localhost:5432/prepai');
    const connectionError = new Error('Postgres unavailable');
    prismaMocks.postgresConnect.mockRejectedValueOnce(connectionError);
    const service = new PrismaPostgresqlService();

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('PostgreSQL connection failed', connectionError);
    expect(prismaMocks.postgresDisconnect).toHaveBeenCalledOnce();
  });
});
