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
import { Outbox } from './entities/outbox.entity';

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
      entities: [Customer, ShipmentOrder, Parcel, Outbox],
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
    // Read-only mapping onto Hub/Sortation Service's ZONE table, used only
    // to resolve region_code -> zone_id for the RateCard lookup above.
    // Order/Pricing never writes here - Hub Service (not yet built) owns
    // this schema.
    TypeOrmModule.forRoot({
      name: 'network',
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_network_db',
      entities: [Zone],
      synchronize: false,
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
