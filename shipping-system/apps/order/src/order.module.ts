import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import Redis from 'ioredis';
import Stripe from 'stripe';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { IOrderRepository } from './ports/order-repository.port';
import { OrderRepository } from './repositories/order.repository';
import { IPricingPort } from './ports/pricing.port';
import { RateCardPricingAdapter } from './adapters/rate-card-pricing.adapter';
import { RateCard } from './entities/rate-card.entity';
import { Zone } from './entities/zone.entity';
import { Outbox } from './entities/outbox.entity';
import { Payment } from './entities/payment.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  REDIS_CLIENT,
  RedisIdempotencyAdapter,
} from './adapters/redis-idempotency.adapter';
import { IOutboxRepository } from './ports/outbox-repository.port';
import { OutboxRepository } from './repositories/outbox.repository';
import { IPaymentRepository } from './ports/payment-repository.port';
import { PaymentRepository } from './repositories/payment.repository';
import { IEventPublisher } from './ports/event-publisher.port';
import {
  NATS_CLIENT,
  NatsEventPublisher,
} from './adapters/nats-event-publisher.adapter';
import { IPaymentGateway } from './ports/payment-gateway.port';
import {
  STRIPE_CLIENT,
  STRIPE_WEBHOOK_SECRET,
  StripePaymentGateway,
} from './adapters/stripe-payment-gateway.adapter';
import { OutboxPollerService } from './outbox-poller.service';
import { ParcelEventConsumer } from './parcel-event.consumer';
import { StatusProjectionConsumer } from './status-projection.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Outbox, Payment, PaymentTransaction]),
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
  controllers: [OrderController, PaymentController, ParcelEventConsumer],
  providers: [
    OrderService,
    PaymentService,
    { provide: IOrderRepository, useClass: OrderRepository },
    { provide: IPricingPort, useClass: RateCardPricingAdapter },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
    { provide: IOutboxRepository, useClass: OutboxRepository },
    { provide: IPaymentRepository, useClass: PaymentRepository },
    { provide: IEventPublisher, useClass: NatsEventPublisher },
    { provide: IPaymentGateway, useClass: StripePaymentGateway },
    {
      provide: STRIPE_CLIENT,
      useFactory: () => new Stripe(process.env.STRIPE_SECRET_KEY ?? ''),
    },
    {
      provide: STRIPE_WEBHOOK_SECRET,
      useFactory: () => process.env.STRIPE_WEBHOOK_SECRET ?? '',
    },
    OutboxPollerService,
    StatusProjectionConsumer,
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
