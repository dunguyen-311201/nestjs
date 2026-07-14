import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import { LinehaulController } from './linehaul.controller';
import { LinehaulService } from './linehaul.service';
import { LinehaulTrip } from './entities/linehaul-trip.entity';
import { Hub } from './entities/hub.entity';
import { Outbox } from './entities/outbox.entity';
import { ILinehaulRepository } from './ports/linehaul-repository.port';
import { LinehaulRepository } from './repositories/linehaul.repository';
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
    TypeOrmModule.forFeature([LinehaulTrip, Hub, Outbox]),
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
  controllers: [LinehaulController],
  providers: [
    LinehaulService,
    { provide: ILinehaulRepository, useClass: LinehaulRepository },
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
export class LinehaulModule {}
