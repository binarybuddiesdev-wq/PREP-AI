import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Redis } from 'ioredis';
import { JOB_QUEUE_NAMES, type TJobQueueName } from '../jobs/job-queue.constants.js';

const RECORD_WORKER_JOB_METRIC_SCRIPT = `
local duration = tonumber(ARGV[1])
if not duration or duration < 0 then
  return redis.error_reply('invalid worker metric duration')
end
redis.call('HINCRBY', KEYS[1], 'attempts', 1)
redis.call('HINCRBYFLOAT', KEYS[1], 'duration_sum', duration)
for index = 2, #ARGV do
  local bucket = tonumber(ARGV[index])
  if duration <= bucket then
    redis.call('HINCRBY', KEYS[1], 'bucket_' .. (index - 1), 1)
  end
end
return 1
`;

const WORKER_JOB_METRIC_QUEUES = new Set(Object.values(JOB_QUEUE_NAMES));
const WORKER_JOB_METRIC_RESULTS = ['success', 'error'] as const;

export interface IWorkerJobMetric {
  queue: TJobQueueName;
  result: (typeof WORKER_JOB_METRIC_RESULTS)[number];
  count: number;
  sum: number;
  buckets: number[];
}

const RESERVE_QUOTA_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current}
end
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return {1, count}
`;

const RELEASE_QUOTA_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 1 then
  return redis.call('DEL', KEYS[1])
end
return redis.call('DECR', KEYS[1])
`;

const RESERVE_UNIQUE_QUOTA_SCRIPT = `
local itemStatus = redis.call('GET', KEYS[2])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if itemStatus == 'solved' then
  return {2, current}
end
if itemStatus == 'reserved' or (itemStatus and string.sub(itemStatus, 1, 9) == 'reserved:') then
  return {3, current}
end
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current}
end
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
redis.call('SET', KEYS[2], 'reserved:' .. ARGV[3], 'EX', tonumber(ARGV[2]))
return {1, count}
`;

const FINALIZE_UNIQUE_QUOTA_SCRIPT = `
if redis.call('GET', KEYS[2]) ~= 'reserved:' .. ARGV[3] then
  return 0
end
if ARGV[1] == 'solved' then
  redis.call('SET', KEYS[2], 'solved', 'EX', tonumber(ARGV[2]))
  return 1
end
redis.call('DEL', KEYS[2])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 1 then
  redis.call('DEL', KEYS[1])
  return 1
end
redis.call('DECR', KEYS[1])
return 1
`;

const RESERVE_TOKEN_QUOTA_SCRIPT = `
local reservation = redis.call('GET', KEYS[2])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if reservation then
  return {2, current}
end
local requested = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
if requested <= 0 or current + requested > limit then
  return {0, current}
end
local count = redis.call('INCRBY', KEYS[1], requested)
if count == requested then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
end
redis.call('SET', KEYS[2], 'reserved:' .. requested, 'EX', tonumber(ARGV[3]))
return {1, count}
`;

const SETTLE_TOKEN_QUOTA_SCRIPT = `
local reservation = redis.call('GET', KEYS[2])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if not reservation then
  return {0, current}
end
if string.sub(reservation, 1, 8) == 'settled:' then
  return {2, current}
end
if string.sub(reservation, 1, 9) ~= 'reserved:' then
  return {0, current}
end
local reserved = tonumber(string.sub(reservation, 10))
local actual = tonumber(ARGV[1])
if not reserved or not actual or actual < 0 then
  return {-1, current}
end
local count = redis.call('INCRBY', KEYS[1], actual - reserved)
redis.call('SET', KEYS[2], 'settled:' .. actual, 'EX', tonumber(ARGV[2]))
return {1, count}
`;

export type TUniqueQuotaReservation = {
  status: 'reserved' | 'already_solved' | 'in_progress' | 'limit';
  count: number;
};

export interface IQuotaReservation {
  allowed: boolean;
  count: number;
}

export interface IRedisMemoryStats {
  usedMemoryBytes: number;
  maxMemoryBytes: number;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private isUnavailable = false;

  constructor(
    config: ConfigService,
    @InjectPinoLogger(RedisService.name) private readonly logger: PinoLogger
  ) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.client.on('ready', this.handleReady);
    this.client.on('error', this.handleError);
  }

  async reserveQuota(key: string, limit: number, ttlSeconds: number): Promise<IQuotaReservation> {
    const result: unknown = await this.client.eval(
      RESERVE_QUOTA_SCRIPT,
      1,
      key,
      String(limit),
      String(ttlSeconds)
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Redis returned an invalid quota reservation result');
    }
    return { allowed: Number(result[0]) === 1, count: Number(result[1]) };
  }

  async releaseQuota(key: string): Promise<void> {
    await this.client.eval(RELEASE_QUOTA_SCRIPT, 1, key);
  }

  getCacheValue(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async incrementMetricCounter(key: string): Promise<number> {
    const count = await this.client.incr(key);
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error('Redis returned an invalid metrics counter value');
    }
    return count;
  }

  async getMetricCounter(key: string): Promise<number> {
    const value = await this.client.get(key);
    if (value === null) return 0;
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error('Redis returned an invalid metrics counter value');
    }
    return count;
  }

  async recordWorkerJobAttempt(
    queue: string,
    result: string,
    durationSeconds: number,
    buckets: readonly number[]
  ): Promise<void> {
    if (
      !WORKER_JOB_METRIC_QUEUES.has(queue as TJobQueueName) ||
      !WORKER_JOB_METRIC_RESULTS.includes(result as (typeof WORKER_JOB_METRIC_RESULTS)[number]) ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 0 ||
      buckets.some((bucket) => !Number.isFinite(bucket) || bucket < 0)
    ) {
      return;
    }

    await this.client.eval(
      RECORD_WORKER_JOB_METRIC_SCRIPT,
      1,
      this.workerJobMetricKey(queue, result),
      String(durationSeconds),
      ...buckets.map(String)
    );
  }

  async getWorkerJobMetrics(): Promise<IWorkerJobMetric[]> {
    const entries = await Promise.all(
      Object.values(JOB_QUEUE_NAMES).flatMap((queue) =>
        WORKER_JOB_METRIC_RESULTS.map(async (result) => {
          const values = await this.client.hgetall(this.workerJobMetricKey(queue, result));
          return {
            queue,
            result,
            count: Number(values.attempts ?? 0),
            sum: Number(values.duration_sum ?? 0),
            buckets: Array.from({ length: 11 }, (_, index) =>
              Number(values[`bucket_${index + 1}`] ?? 0)
            ),
          } satisfies IWorkerJobMetric;
        })
      )
    );
    return entries;
  }

  async getMemoryStats(): Promise<IRedisMemoryStats> {
    const info = await this.client.info('memory');
    const usedMemory = info.match(/^used_memory:(\d+)$/m)?.[1];
    const maxMemory = info.match(/^maxmemory:(\d+)$/m)?.[1];
    const usedMemoryBytes = Number(usedMemory);
    const maxMemoryBytes = Number(maxMemory);

    if (
      !usedMemory ||
      !maxMemory ||
      !Number.isSafeInteger(usedMemoryBytes) ||
      !Number.isSafeInteger(maxMemoryBytes)
    ) {
      throw new Error('invalid Redis memory INFO response');
    }

    return { usedMemoryBytes, maxMemoryBytes };
  }

  private workerJobMetricKey(queue: string, result: string): string {
    return `prepai:metrics:worker-job:{${queue}}:${result}`;
  }

  async setCacheValue(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async deleteCacheValues(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(...keys);
  }

  async reserveTokenQuota(
    quotaKey: string,
    reservationKey: string,
    reservedTokens: number,
    limit: number,
    ttlSeconds: number
  ): Promise<IQuotaReservation> {
    if (
      !Number.isSafeInteger(reservedTokens) ||
      reservedTokens <= 0 ||
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      !Number.isSafeInteger(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      throw new Error('invalid token quota reservation parameters');
    }
    const result: unknown = await this.client.eval(
      RESERVE_TOKEN_QUOTA_SCRIPT,
      2,
      quotaKey,
      reservationKey,
      String(reservedTokens),
      String(limit),
      String(ttlSeconds)
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('invalid token quota reservation result');
    }
    const status = Number(result[0]);
    const count = Number(result[1]);
    if (![0, 1, 2].includes(status) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('invalid token quota reservation result');
    }
    return { allowed: status !== 0, count };
  }

  async settleTokenQuota(
    quotaKey: string,
    reservationKey: string,
    actualTokens: number,
    ttlSeconds: number
  ): Promise<{ settled: boolean; count: number }> {
    if (
      !Number.isSafeInteger(actualTokens) ||
      actualTokens < 0 ||
      !Number.isSafeInteger(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      throw new Error('invalid token quota settlement parameters');
    }
    const result: unknown = await this.client.eval(
      SETTLE_TOKEN_QUOTA_SCRIPT,
      2,
      quotaKey,
      reservationKey,
      String(actualTokens),
      String(ttlSeconds)
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('invalid token quota settlement result');
    }
    const status = Number(result[0]);
    const count = Number(result[1]);
    if (![0, 1, 2].includes(status) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('invalid token quota settlement result');
    }
    return { settled: status !== 0, count };
  }

  async reserveUniqueQuota(
    quotaKey: string,
    itemKey: string,
    limit: number,
    ttlSeconds: number,
    reservationToken: string
  ): Promise<TUniqueQuotaReservation> {
    const result: unknown = await this.client.eval(
      RESERVE_UNIQUE_QUOTA_SCRIPT,
      2,
      quotaKey,
      itemKey,
      String(limit),
      String(ttlSeconds),
      reservationToken
    );
    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('invalid unique quota reservation result');
    }

    const status = Number(result[0]);
    const count = Number(result[1]);
    const statuses: Record<number, TUniqueQuotaReservation['status']> = {
      0: 'limit',
      1: 'reserved',
      2: 'already_solved',
      3: 'in_progress',
    };
    const mappedStatus = statuses[status];
    if (!mappedStatus || !Number.isFinite(count)) {
      throw new Error('invalid unique quota reservation result');
    }

    return { status: mappedStatus, count };
  }

  async finalizeUniqueQuota(
    quotaKey: string,
    itemKey: string,
    outcome: 'solved' | 'release',
    ttlSeconds: number,
    reservationToken: string
  ): Promise<void> {
    await this.client.eval(
      FINALIZE_UNIQUE_QUOTA_SCRIPT,
      2,
      quotaKey,
      itemKey,
      outcome,
      String(ttlSeconds),
      reservationToken
    );
  }

  ping(): Promise<string> {
    return this.client.ping();
  }

  getRateLimitClient(): Redis {
    return this.client;
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  private readonly handleReady = (): void => {
    this.isUnavailable = false;
  };

  private readonly handleError = (error: Error): void => {
    if (this.isUnavailable) return;
    this.isUnavailable = true;
    this.logger.warn({ error: error.message }, 'Redis is unavailable');
  };
}
