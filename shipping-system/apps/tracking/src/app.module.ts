import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { TrackingModule } from './tracking.module';
import { TrackingEvent } from './entities/tracking-event.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { Parcel } from './entities/parcel.entity';

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
      schema: 'shipping_tracking_db',
      entities: [TrackingEvent],
      synchronize: false,
    }),
    // Read-only mapping onto Order Service's SHIPMENT_ORDER/PARCEL tables,
    // used only to resolve a tracking_id (shipment_order_id) to its parcel
    // ids/states for GET /tracking/:trackingId. Tracking never writes here.
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
    TrackingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
