import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { IOrderRepository } from './ports/order-repository.port';
import { OrderRepository } from './repositories/order.repository';
import { IPricingPort } from './ports/pricing.port';
import { RateCardPricingAdapter } from './adapters/rate-card-pricing.adapter';
import { RateCard } from './entities/rate-card.entity';
import { Zone } from './entities/zone.entity';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  REDIS_CLIENT,
  RedisIdempotencyAdapter,
} from './adapters/redis-idempotency.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([RateCard], 'pricing'),
    TypeOrmModule.forFeature([Zone], 'network'),
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    { provide: IOrderRepository, useClass: OrderRepository },
    { provide: IPricingPort, useClass: RateCardPricingAdapter },
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
