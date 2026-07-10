import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { IOrderRepository } from './ports/order-repository.port';
import { OrderRepository } from './repositories/order.repository';
import { IPricingPort } from './ports/pricing.port';
import { RateCardPricingAdapter } from './adapters/rate-card-pricing.adapter';
import { RateCard } from './entities/rate-card.entity';
import { Zone } from './entities/zone.entity';
import { Outbox } from './entities/outbox.entity';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  REDIS_CLIENT,
  RedisIdempotencyAdapter,
} from './adapters/redis-idempotency.adapter';
import { IOutboxRepository } from './ports/outbox-repository.port';
import { OutboxRepository } from './repositories/outbox.repository';
import { IEventPublisher } from './ports/event-publisher.port';
import {
  NATS_CLIENT,
  NatsEventPublisher,
} from './adapters/nats-event-publisher.adapter';
import { OutboxPollerService } from './outbox-poller.service';
import { ParcelEventConsumer } from './parcel-event.consumer';
import { StatusProjectionConsumer } from './status-projection.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Outbox]),
    TypeOrmModule.forFeature([RateCard], 'pricing'),
    TypeOrmModule.forFeature([Zone], 'network'),
    ClientsModule.register([
      {
        name: NATS_CLIENT,
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
        },
      },
    ]),
  ],
  controllers: [OrderController, ParcelEventConsumer, StatusProjectionConsumer],
  providers: [
    OrderService,
    { provide: IOrderRepository, useClass: OrderRepository },
    { provide: IPricingPort, useClass: RateCardPricingAdapter },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
    { provide: IOutboxRepository, useClass: OutboxRepository },
    { provide: IEventPublisher, useClass: NatsEventPublisher },
    OutboxPollerService,
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
