import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { OrderModule } from './order.module';
import { Customer } from './entities/customer.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { Parcel } from './entities/parcel.entity';
import { RateCard } from './entities/rate-card.entity';
import { Zone } from './entities/zone.entity';
import { Route } from './entities/route.entity';
import { Outbox } from './entities/outbox.entity';
import { Payment } from './entities/payment.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_order_db',
      entities: [
        Customer,
        ShipmentOrder,
        Parcel,
        Outbox,
        Payment,
        PaymentTransaction,
      ],
      synchronize: false,
    }),
    OrderModule,
    // Pricing has no public REST surface and is invoked in-process by Order
    // only - it is not its own app, but it keeps its own schema/connection,
    // named so it doesn't collide with Order's default connection above.
    TypeOrmModule.forRoot({
      name: 'pricing',
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_pricing_db',
      entities: [RateCard],
      synchronize: false,
    }),
    // Read-only mapping onto Hub/Sortation Service's ZONE/ROUTE tables, used
    // to resolve region_code -> zone_id and the (origin, dest) corridor for
    // the RateCard lookup + PARCEL.route_id at order creation above.
    // Order/Pricing never writes here - Hub Service (task 6.2) owns this
    // schema.
    TypeOrmModule.forRoot({
      name: 'network',
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_network_db',
      entities: [Zone, Route],
      synchronize: false,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
