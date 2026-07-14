import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { HubController } from './hub.controller';
import { HubService } from './hub.service';
import { Hub } from './entities/hub.entity';
import { Route } from './entities/route.entity';
import { Outbox } from './entities/outbox.entity';
import { Parcel } from './entities/parcel.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { OrderLookupAdapter } from './adapters/order-lookup.adapter';
import { IHubRepository } from './ports/hub-repository.port';
import { HubRepository } from './repositories/hub.repository';
import { IOutboxRepository } from './ports/outbox-repository.port';
import { OutboxRepository } from './repositories/outbox.repository';
import { IEventPublisher } from './ports/event-publisher.port';
import {
  NATS_CLIENT,
  NatsEventPublisher,
} from './adapters/nats-event-publisher.adapter';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  REDIS_CLIENT,
  RedisIdempotencyAdapter,
} from './adapters/redis-idempotency.adapter';
import { OutboxPollerService } from './outbox-poller.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hub, Route, Outbox]),
    TypeOrmModule.forFeature([Parcel, ShipmentOrder], 'order'),
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
  controllers: [HubController],
  providers: [
    HubService,
    { provide: IOrderLookupPort, useClass: OrderLookupAdapter },
    { provide: IHubRepository, useClass: HubRepository },
    { provide: IOutboxRepository, useClass: OutboxRepository },
    { provide: IEventPublisher, useClass: NatsEventPublisher },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
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
export class HubModule {}
