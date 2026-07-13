import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingEvent } from './entities/tracking-event.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { Parcel } from './entities/parcel.entity';
import { ITrackingEventRepository } from './ports/tracking-event-repository.port';
import { TrackingEventRepository } from './repositories/tracking-event.repository';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { OrderLookupAdapter } from './adapters/order-lookup.adapter';
import { IStatusCachePort } from './ports/status-cache.port';
import {
  REDIS_CLIENT,
  RedisStatusCacheAdapter,
} from './adapters/redis-status-cache.adapter';
import { TrackingEventConsumer } from './nats/tracking-event.consumer';
import { NATS_CLIENT } from './nats/nats-client.token';
import {
  JETSTREAM_CLIENT,
  createJetStreamClient,
} from './nats/jetstream-client.provider';
import { IStatusTriggerPublisher } from './ports/status-trigger-publisher.port';
import { JetStreamStatusTriggerPublisher } from './adapters/jetstream-status-trigger.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackingEvent]),
    TypeOrmModule.forFeature([ShipmentOrder, Parcel], 'order'),
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
  controllers: [TrackingController, TrackingEventConsumer],
  providers: [
    TrackingService,
    { provide: ITrackingEventRepository, useClass: TrackingEventRepository },
    { provide: IOrderLookupPort, useClass: OrderLookupAdapter },
    { provide: IStatusCachePort, useClass: RedisStatusCacheAdapter },
    {
      provide: IStatusTriggerPublisher,
      useClass: JetStreamStatusTriggerPublisher,
    },
    { provide: JETSTREAM_CLIENT, useFactory: createJetStreamClient },
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
export class TrackingModule {}
