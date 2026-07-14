import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HubModule } from './hub.module';
import { Hub } from './entities/hub.entity';
import { Route } from './entities/route.entity';
import { Outbox } from './entities/outbox.entity';
import { Parcel } from './entities/parcel.entity';
import { ShipmentOrder } from './entities/shipment-order.entity';

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
      schema: 'shipping_network_db',
      entities: [Hub, Route, Outbox],
      synchronize: false,
    }),
    // Read-only mapping onto Order Service's SHIPMENT_ORDER/PARCEL tables,
    // used only for the BR-08 hub-inbound guard and to resolve a parcel's
    // current route for misroute detection (BR-02). Hub never writes here.
    TypeOrmModule.forRoot({
      name: 'order',
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_order_db',
      entities: [Parcel, ShipmentOrder],
      synchronize: false,
    }),
    HubModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
