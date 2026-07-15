import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { DispatcherController } from './dispatcher.controller';
import { DispatcherService } from './dispatcher.service';
import { LinehaulTrip } from './entities/linehaul-trip.entity';
import { Driver } from './entities/driver.entity';
import { Truck } from './entities/truck.entity';
import { Courier } from './entities/courier.entity';
import { Parcel } from './entities/parcel.entity';
import { Outbox } from './entities/outbox.entity';
import { IDispatcherRepository } from './ports/dispatcher-repository.port';
import { DispatcherRepository } from './repositories/dispatcher.repository';
import { ICourierLookupPort } from './ports/courier-lookup.port';
import { CourierLookupAdapter } from './adapters/courier-lookup.adapter';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { OrderLookupAdapter } from './adapters/order-lookup.adapter';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([LinehaulTrip, Driver, Truck, Outbox]),
    TypeOrmModule.forFeature([Courier], 'courier'),
    TypeOrmModule.forFeature([Parcel], 'order'),
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
  controllers: [DispatcherController],
  providers: [
    DispatcherService,
    { provide: IDispatcherRepository, useClass: DispatcherRepository },
    { provide: ICourierLookupPort, useClass: CourierLookupAdapter },
    { provide: IOrderLookupPort, useClass: OrderLookupAdapter },
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
export class DispatcherModule {}
