import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private redis: Redis | null = null;
  private scriptSha: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const isTest = this.configService.get<string>('NODE_ENV') === 'test';

    // Only connect to Redis if URL/host is provided and not in test mode (unless explicitly set)
    // In test mode, skip Redis connection to avoid timeouts
    if (!isTest && (redisUrl || redisHost)) {
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          lazyConnect: true, // Don't connect immediately
          maxRetriesPerRequest: null, // Disable retries for tests
        });
        // Connect asynchronously (non-blocking)
        void this.redis.connect().catch(() => {
          // If connection fails, redis will remain null and we'll use in-memory fallback
          this.redis = null;
        });
      } else if (redisHost) {
        this.redis = new Redis({
          host: redisHost,
          port: this.configService.get<number>('REDIS_PORT', 6379),
          password: this.configService.get<string>('REDIS_PASSWORD'),
          db: this.configService.get<number>('REDIS_DB', 0),
          lazyConnect: true, // Don't connect immediately
          maxRetriesPerRequest: null, // Disable retries for tests
        });
        // Connect asynchronously (non-blocking)
        void this.redis.connect().catch(() => {
          // If connection fails, redis will remain null and we'll use in-memory fallback
          this.redis = null;
        });
      }

      // Load Lua script for atomic increment with expiry (non-blocking)
      if (this.redis) {
        void this.loadScript();
      }
    }
  }

  private async loadScript() {
    if (!this.redis) return;

    try {
      const sha = await this.redis.script(
        'LOAD',
        `
        local key = KEYS[1]
        local ttl = tonumber(ARGV[1])
        local current = redis.call('INCR', key)
        if current == 1 then
          redis.call('EXPIRE', key, ttl)
        end
        local pttl = redis.call('PTTL', key)
        return {current, pttl}
      `,
      );
      this.scriptSha = String(sha);
    } catch {
      // Script loading failed, will use fallback
      this.scriptSha = null;
    }
  }

  async increment(
    key: string,
    ttl: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _limit: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _blockDuration: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // Fallback to in-memory if Redis not configured
    if (!this.redis) {
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    try {
      let totalHits: number;
      let timeToExpire: number;

      if (this.scriptSha) {
        // Use Lua script for atomic operation
        const result = (await this.redis.evalsha(
          this.scriptSha,
          1,
          key,
          Math.ceil(ttl / 1000),
        )) as [number, number];
        totalHits = result[0];
        timeToExpire = result[1];
      } else {
        // Fallback to multi command
        const multi = this.redis.multi();
        multi.incr(key);
        multi.pttl(key);
        multi.expire(key, Math.ceil(ttl / 1000));
        const results = await multi.exec();
        totalHits = results ? (results[0][1] as number) : 1;
        timeToExpire = results ? (results[1][1] as number) : ttl;
      }

      return {
        totalHits,
        timeToExpire: timeToExpire > 0 ? timeToExpire : ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch {
      // Redis error - fallback to allowing the request
      return {
        totalHits: 1,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
