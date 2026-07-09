import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { IIdempotencyStore } from '../ports/idempotency-store.port';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisIdempotencyAdapter implements IIdempotencyStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}
