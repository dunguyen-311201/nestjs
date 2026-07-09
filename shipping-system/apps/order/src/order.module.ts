import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { IOrderRepository } from './ports/order-repository.port';
import { OrderRepository } from './repositories/order.repository';
import { IPricingPort } from './ports/pricing.port';
import { PricingStubAdapter } from './adapters/pricing-stub.adapter';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  REDIS_CLIENT,
  RedisIdempotencyAdapter,
} from './adapters/redis-idempotency.adapter';

@Module({
  controllers: [OrderController],
  providers: [
    OrderService,
    { provide: IOrderRepository, useClass: OrderRepository },
    { provide: IPricingPort, useClass: PricingStubAdapter },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        }),
    },
  ],
})
export class OrderModule {}
