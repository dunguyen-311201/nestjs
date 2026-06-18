import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard, LoggingMiddleware } from '@app/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { Reservation } from './entities/reservation.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { JwtModule } from '@nestjs/jwt/dist/jwt.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'product_db',
      entities: [Product, Category, Reservation],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Product, Category, Reservation]),
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [
    ProductsController,
    CategoriesController,
    ReservationController,
  ],
  providers: [
    ProductsService,
    CategoriesService,
    ReservationService,
    JwtAuthGuard,
  ],
})
export class ProductsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
