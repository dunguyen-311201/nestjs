import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { IStatusCachePort } from '../ports/status-cache.port';

export const REDIS_CLIENT = 'REDIS_CLIENT';

function statusCacheKey(shipmentOrderId: string): string {
  return `order:status:${shipmentOrderId}`;
}

@Injectable()
export class RedisStatusCacheAdapter implements IStatusCachePort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getStatus(shipmentOrderId: string): Promise<string | null> {
    return this.redis.get(statusCacheKey(shipmentOrderId));
  }
}
