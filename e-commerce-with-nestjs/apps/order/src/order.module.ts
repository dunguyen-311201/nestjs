import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConsulService } from './consul.service';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { HealthController } from './health.controller';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { JwtModule } from '@nestjs/jwt/dist/jwt.module';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';
import { ConfigModule } from '@nestjs/config/dist/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'order_db',
      entities: [Order, OrderItem],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Order, OrderItem]),
    ClientsModule.register([
      {
        name: 'INVENTORY_SERVICE',
        transport: Transport.TCP,
        options: { port: 8002 },
      },
    ]),
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [HealthController, OrderController],
  providers: [OrderService, ConsulService, JwtAuthGuard],
})
export class OrderModule {}
