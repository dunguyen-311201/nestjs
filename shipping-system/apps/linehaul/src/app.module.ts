import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { LinehaulModule } from './linehaul.module';
import { LinehaulTrip } from './entities/linehaul-trip.entity';
import { Hub } from './entities/hub.entity';
import { Outbox } from './entities/outbox.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Shares shipping_network_db with Hub Service (task 6.2) by the
    // original architecture (ADR-003 + docs/02-HLD.md's data-ownership
    // table) - Hub/Route/Zone/Outbox are read-only or already-migrated
    // here; this app only ever writes LINEHAULTRIP.
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'postgres',
      password: process.env.POSTGRES_PASSWORD ?? 'postgres',
      database: process.env.POSTGRES_DB ?? 'postgres',
      schema: 'shipping_network_db',
      entities: [LinehaulTrip, Hub, Outbox],
      synchronize: false,
    }),
    LinehaulModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
