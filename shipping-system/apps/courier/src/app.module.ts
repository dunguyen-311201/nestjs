import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { CourierModule } from './courier.module';
import { ProofOfDelivery } from './entities/proof-of-delivery.entity';
import { DeliveryAttempt } from './entities/delivery-attempt.entity';
import { Outbox } from './entities/outbox.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { Parcel } from './entities/parcel.entity';
import { Courier } from './entities/courier.entity';

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
      schema: 'shipping_courier_db',
      entities: [ProofOfDelivery, DeliveryAttempt, Outbox, Courier],
      synchronize: false,
    }),
    // Read-only mapping onto Order Service's SHIPMENT_ORDER/PARCEL tables,
    // used only for the paid-order pickup guard and to resolve a parcel's
    // current leg direction. Courier never writes here.
    TypeOrmModule.forRoot({
      name: 'order',
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_order_db',
      entities: [ShipmentOrder, Parcel],
      synchronize: false,
    }),
    CourierModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
