import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { ProofOfDelivery } from './entities/proof-of-delivery.entity';
import { DeliveryAttempt } from './entities/delivery-attempt.entity';
import { Parcel } from './entities/parcel.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { OrderLookupAdapter } from './adapters/order-lookup.adapter';
import { ICourierRepository } from './ports/courier-repository.port';
import { CourierRepository } from './repositories/courier.repository';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([ProofOfDelivery, DeliveryAttempt]),
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
  controllers: [CourierController],
  providers: [
    CourierService,
    { provide: IOrderLookupPort, useClass: OrderLookupAdapter },
    { provide: ICourierRepository, useClass: CourierRepository },
    { provide: IEventPublisher, useClass: NatsEventPublisher },
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
export class CourierModule {}
